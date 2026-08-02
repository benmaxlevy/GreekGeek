import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  EventPayout as PrismaEventPayout,
  EventPayoutAudit as PrismaEventPayoutAudit,
} from '@prisma/client';
import type { PublicUser } from '../auth/types/auth.dto';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import type {
  EventPayout,
  EventPayoutActionResponse,
  EventPayoutAudit,
  EventPayoutQueue,
  EventPayoutSummary,
  PayoutEventLockRow,
  PayoutReleaseInput,
} from './types/event-payout.dto';

type PayoutEventRow = Omit<
  PayoutEventLockRow,
  'stripeAccountId' | 'stripePayoutsEnabled' | 'stripeTransfersEnabled'
> & {
  organization: Pick<
    PayoutEventLockRow,
    'stripeAccountId' | 'stripePayoutsEnabled' | 'stripeTransfersEnabled'
  >;
};

type Readiness = EventPayoutSummary['readiness'];
type BlockedReason = EventPayoutSummary['blockedReason'];
const MAX_AUTOMATIC_PAYOUT_ATTEMPTS = 5;

@Injectable()
export class EventPayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async getSummary(eventId: string, caller: PublicUser): Promise<EventPayoutSummary> {
    const event = await this.requireEvent(eventId);
    await this.assertCanRead(event.organizationId, caller);
    return this.buildSummary(event);
  }

  async listQueue(caller: PublicUser): Promise<EventPayoutQueue> {
    this.assertAdmin(caller);
    const events = await this.prisma.event.findMany({
      include: {
        organization: {
          select: {
            stripeAccountId: true,
            stripePayoutsEnabled: true,
            stripeTransfersEnabled: true,
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
    const summaries = await Promise.all(events.map((event) => this.buildSummary(event)));
    return summaries.map((summary) => ({
      ...summary,
      eligibleNow:
        summary.blockedReason === null && summary.readiness.ready && summary.pendingCents > 0,
    }));
  }

  async release(
    eventId: string,
    input: PayoutReleaseInput,
    caller: PublicUser,
  ): Promise<EventPayoutActionResponse> {
    this.assertAdmin(caller);
    const reason = input.reason?.trim();
    if (input.mode === 'manual' && !reason) {
      throw new BadRequestException('Reason is required');
    }

    const result = await this.releaseLocked(eventId, {
      ...input,
      actorUserId: caller.id,
      reason,
      bypassTimeGate: input.mode === 'manual',
    });
    const audit = await this.prisma.eventPayoutAudit.create({
      data: {
        eventId,
        eventPayoutId: result?.id ?? null,
        actorUserId: caller.id,
        action: 'release',
        reason: reason ?? 'automatic release',
      },
    });
    return { payout: result ? this.toPayoutDto(result) : null, audit: this.toAuditDto(audit) };
  }

  async retry(
    eventId: string,
    payoutId: string,
    reason: string,
    caller: PublicUser,
  ): Promise<EventPayoutActionResponse> {
    this.assertAdmin(caller);
    const payout = await this.prisma.eventPayout.findFirst({
      where: { id: payoutId, eventId },
    });
    if (!payout) {
      throw new NotFoundException('Event payout not found');
    }
    if (payout.status !== 'failed') {
      throw new BadRequestException('Only failed payouts can be retried');
    }
    const result = await this.releaseLocked(eventId, {
      eventId,
      mode: 'manual',
      actorUserId: caller.id,
      reason,
      bypassTimeGate: true,
    });
    const audit = await this.prisma.eventPayoutAudit.create({
      data: {
        eventId,
        eventPayoutId: result?.id ?? payoutId,
        actorUserId: caller.id,
        action: 'retry',
        reason: reason.trim(),
      },
    });
    return { payout: result ? this.toPayoutDto(result) : null, audit: this.toAuditDto(audit) };
  }

  async releaseEligible(eventId: string): Promise<EventPayout | null> {
    const result = await this.releaseLocked(eventId, {
      eventId,
      mode: 'auto',
      bypassTimeGate: false,
    });
    return result ? this.toPayoutDto(result) : null;
  }

  async sweepEligible(): Promise<number> {
    let released = 0;
    let page = 0;
    const pageSize = 100;
    while (true) {
      const events = await this.prisma.event.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
        take: pageSize,
        skip: page * pageSize,
      });
      for (const event of events) {
        const payout = await this.releaseEligible(event.id);
        if (payout?.status === 'released') {
          released += 1;
        }
      }
      if (events.length < pageSize) {
        break;
      }
      page += 1;
    }
    return released;
  }

  async evaluateReadiness(organizationId: string): Promise<Readiness> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        stripeAccountId: true,
        stripePayoutsEnabled: true,
        stripeTransfersEnabled: true,
      },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    const blockedReason = organization.stripeAccountId
      ? organization.stripePayoutsEnabled
        ? organization.stripeTransfersEnabled
          ? null
          : 'transfers_disabled'
        : 'payouts_disabled'
      : 'missing_stripe_account';
    return {
      ...organization,
      ready: blockedReason === null,
      blockedReason,
    };
  }

  private async releaseLocked(
    eventId: string,
    input: PayoutReleaseInput,
  ): Promise<PrismaEventPayout | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<PayoutEventLockRow[]>`
          SELECT e.id, e."organizationId", e."startsAt", e."endsAt",
                 e."heldAt", e."heldByUserId",
                 o."stripeAccountId", o."stripePayoutsEnabled",
                 o."stripeTransfersEnabled"
          FROM "Event" e
          INNER JOIN "Organization" o ON o.id = e."organizationId"
          WHERE e.id = ${eventId}
          FOR UPDATE
        `;
        const event = locked[0];
        if (!event) {
          throw new NotFoundException('Event not found');
        }
        const eventWithOrganization: PayoutEventRow = {
          id: event.id,
          organizationId: event.organizationId,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          heldAt: event.heldAt,
          heldByUserId: event.heldByUserId,
          organization: {
            stripeAccountId: event.stripeAccountId,
            stripePayoutsEnabled: event.stripePayoutsEnabled,
            stripeTransfersEnabled: event.stripeTransfersEnabled,
          },
        };
        if (eventWithOrganization.heldAt) {
          return null;
        }
        const readiness = this.readinessFromEvent(eventWithOrganization);
        if (!readiness.ready) {
          if (!input.bypassTimeGate) {
            return null;
          }
          throw new BadRequestException(`Payout blocked: ${readiness.blockedReason}`);
        }
        const expected = this.expectedPayoutDate(eventWithOrganization);
        if (!input.bypassTimeGate && expected.getTime() > Date.now()) {
          return null;
        }

        const purchases = await tx.purchase.findMany({
          where: {
            eventId,
            status: 'succeeded',
            eventPayoutId: null,
            payoutExcludedReason: null,
          },
          select: { id: true, netCents: true },
        });
        const amountCents = purchases.reduce((total, purchase) => total + purchase.netCents, 0);
        if (amountCents <= 0) {
          return null;
        }

        const current = await tx.eventPayout.findFirst({
          where: { eventId, status: { in: ['pending', 'failed'] } },
          orderBy: { batchSeq: 'asc' },
        });
        if (
          current?.status === 'failed' &&
          current.attempts >= MAX_AUTOMATIC_PAYOUT_ATTEMPTS &&
          input.mode === 'auto'
        ) {
          return current;
        }
        const payout =
          current ??
          (await tx.eventPayout.create({
            data: {
              eventId,
              batchSeq:
                ((
                  await tx.eventPayout.aggregate({
                    where: { eventId },
                    _max: { batchSeq: true },
                  })
                )._max.batchSeq ?? 0) + 1,
              amountCents,
              status: 'pending',
            },
          }));

        const pending = await tx.eventPayout.update({
          where: { id: payout.id },
          data: {
            amountCents,
            status: 'pending',
            attempts: { increment: 1 },
            lastError: null,
          },
        });

        try {
          if (!eventWithOrganization.organization.stripeAccountId) {
            throw new Error('missing_stripe_account');
          }
          const transfer = await this.stripe.createTransfer({
            amountCents,
            currency: 'usd',
            destinationAccountId: eventWithOrganization.organization.stripeAccountId,
            metadata: {
              eventId,
              batchSeq: String(pending.batchSeq),
              payoutId: pending.id,
            },
            idempotencyKey: `event-payout-${pending.id}`,
          });
          const released = await tx.eventPayout.update({
            where: { id: pending.id },
            data: {
              amountCents,
              status: 'released',
              releasedAt: new Date(),
              releaseMode: input.mode,
              releasedByUserId: input.actorUserId,
              stripeTransferId: transfer.id,
              lastError: null,
            },
          });
          await tx.purchase.updateMany({
            where: {
              id: { in: purchases.map((purchase) => purchase.id) },
              eventPayoutId: null,
              payoutExcludedReason: null,
            },
            data: { eventPayoutId: pending.id },
          });
          return released;
        } catch (error) {
          const lastError = this.conciseError(error);
          return tx.eventPayout.update({
            where: { id: pending.id },
            data: {
              status: 'failed',
              lastError,
            },
          });
        }
      },
      { timeout: 120_000 },
    );
  }

  private async buildSummary(event: PayoutEventRow): Promise<EventPayoutSummary> {
    const purchases = await this.prisma.purchase.findMany({
      where: { eventId: event.id },
      select: {
        amountCents: true,
        feeCents: true,
        netCents: true,
        status: true,
        eventPayoutId: true,
        payoutExcludedReason: true,
      },
    });
    const payouts = await this.prisma.eventPayout.findMany({
      where: { eventId: event.id },
      orderBy: { batchSeq: 'asc' },
    });
    const audits = await this.prisma.eventPayoutAudit.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'asc' },
    });
    const grossAmountCents = purchases.reduce((sum, row) => sum + row.amountCents, 0);
    const feeCents = purchases.reduce((sum, row) => sum + row.feeCents, 0);
    const netCents = purchases.reduce((sum, row) => sum + row.netCents, 0);
    const excluded = purchases.filter((row) => row.payoutExcludedReason);
    const pending = purchases.filter(
      (row) =>
        row.status === 'succeeded' &&
        row.eventPayoutId === null &&
        row.payoutExcludedReason === null,
    );
    const releasedCents = payouts
      .filter((row) => row.status === 'released')
      .reduce((sum, row) => sum + row.amountCents, 0);
    const excludedByReason = {
      disputed: excluded
        .filter((row) => row.payoutExcludedReason === 'disputed')
        .reduce((sum, row) => sum + row.netCents, 0),
      refunded: excluded
        .filter((row) => row.payoutExcludedReason === 'refunded')
        .reduce((sum, row) => sum + row.netCents, 0),
      voided: excluded
        .filter((row) => row.payoutExcludedReason === 'voided')
        .reduce((sum, row) => sum + row.netCents, 0),
    };
    const readiness = this.readinessFromEvent(event);
    let blockedReason: BlockedReason = readiness.blockedReason;
    if (event.heldAt) {
      blockedReason = 'held';
    } else if (blockedReason === null && this.expectedPayoutDate(event).getTime() > Date.now()) {
      blockedReason = 'before_hold_period';
    } else if (blockedReason === null && pending.length === 0) {
      blockedReason = 'no_eligible_purchases';
    }
    return {
      eventId: event.id,
      grossAmountCents,
      feeCents,
      netCents,
      releasedCents,
      pendingCents: pending.reduce((sum, row) => sum + row.netCents, 0),
      excludedCents: excluded.reduce((sum, row) => sum + row.netCents, 0),
      excludedCount: excluded.length,
      excludedByReason,
      expectedPayoutDate: this.expectedPayoutDate(event).toISOString(),
      heldAt: event.heldAt?.toISOString() ?? null,
      heldByUserId: event.heldByUserId,
      blockedReason,
      readiness,
      postReleaseExposure: payouts.some((row) => row.postReleaseExposure),
      payouts: payouts.map((row) => this.toPayoutDto(row)),
      audits: audits.map((row) => this.toAuditDto(row)),
    };
  }

  private readinessFromEvent(event: PayoutEventRow): Readiness {
    const blockedReason = event.organization.stripeAccountId
      ? event.organization.stripePayoutsEnabled
        ? event.organization.stripeTransfersEnabled
          ? null
          : 'transfers_disabled'
        : 'payouts_disabled'
      : 'missing_stripe_account';
    return {
      stripeAccountId: event.organization.stripeAccountId,
      stripePayoutsEnabled: event.organization.stripePayoutsEnabled,
      stripeTransfersEnabled: event.organization.stripeTransfersEnabled,
      ready: blockedReason === null,
      blockedReason,
    };
  }

  private expectedPayoutDate(event: Pick<PayoutEventRow, 'startsAt' | 'endsAt'>): Date {
    const date = event.endsAt ?? event.startsAt;
    const holdDays = this.config.get('PAYOUT_HOLD_DAYS', { infer: true });
    return new Date(date.getTime() + holdDays * 86_400_000);
  }

  private async requireEvent(eventId: string): Promise<PayoutEventRow> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organization: {
          select: {
            stripeAccountId: true,
            stripePayoutsEnabled: true,
            stripeTransfersEnabled: true,
          },
        },
      },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  private async assertCanRead(organizationId: string, caller: PublicUser): Promise<void> {
    if (caller.role === 'ADMIN') {
      return;
    }
    const membership = await this.prisma.membership.findUnique({
      where: { userId: caller.id },
      include: { permissions: { include: { permission: true } } },
    });
    if (
      !membership ||
      membership.organizationId !== organizationId ||
      !membership.permissions.some((row) => row.permission.key === 'payments.manage')
    ) {
      throw new ForbiddenException('Missing organization permission');
    }
  }

  private assertAdmin(caller: PublicUser): void {
    if (caller.role !== 'ADMIN') {
      throw new ForbiddenException('Payout operations require ADMIN');
    }
  }

  private conciseError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/\s+/g, ' ').slice(0, 240);
  }

  private toPayoutDto(row: PrismaEventPayout): EventPayout {
    return {
      id: row.id,
      eventId: row.eventId,
      batchSeq: row.batchSeq,
      amountCents: row.amountCents,
      status: row.status,
      releasedAt: row.releasedAt?.toISOString() ?? null,
      releaseMode: row.releaseMode,
      releasedByUserId: row.releasedByUserId,
      stripeTransferId: row.stripeTransferId,
      attempts: row.attempts,
      lastError: row.lastError,
      postReleaseExposure: row.postReleaseExposure,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toAuditDto(row: PrismaEventPayoutAudit): EventPayoutAudit {
    return {
      id: row.id,
      eventId: row.eventId,
      eventPayoutId: row.eventPayoutId,
      actorUserId: row.actorUserId,
      action: row.action,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
