import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import type { PublicUser } from '../auth/types/auth.dto';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import {
  assertPurchaseAmountInvariant,
  computePurchaseAmounts,
  type PurchaseCheckoutResponse,
} from './types/purchase.dto';

type AllocationLockRow = {
  id: string;
  eventId: string;
  organizationId: string | null;
  quantity: number;
  priceCents: number | null;
  status: string;
};

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async checkout(
    input: { allocationId: string; quantity: number },
    caller: PublicUser,
  ): Promise<PurchaseCheckoutResponse> {
    if (caller.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is not active');
    }

    const allocation = await this.prisma.ticketAllocation.findUnique({
      where: { id: input.allocationId },
      include: {
        event: {
          include: {
            organization: { select: { stripeChargesEnabled: true } },
          },
        },
      },
    });
    if (!allocation) {
      throw new NotFoundException('Allocation not found');
    }

    await this.assertBuyerEligible(allocation, caller);
    this.assertCheckoutPreconditions(allocation);

    const unitPriceCents = allocation.priceCents ?? 0;
    const feePercent = this.config.get('RALLY_FEE_PERCENT', { infer: true });
    const maxPerUser = this.config.get('MAX_TICKETS_PER_USER_PER_EVENT', {
      infer: true,
    });

    const reserved = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<AllocationLockRow[]>`
        SELECT id, "eventId", "organizationId", quantity, "priceCents", status
        FROM "TicketAllocation"
        WHERE id = ${allocation.id}
        FOR UPDATE
      `;
      const current = locked[0];
      if (!current || current.status !== 'active') {
        throw new BadRequestException('Allocation is closed');
      }

      const existing = await tx.purchase.findFirst({
        where: {
          buyerUserId: caller.id,
          allocationId: allocation.id,
          status: 'requires_payment',
        },
      });

      if (existing) {
        await tx.ticket.deleteMany({
          where: { purchaseId: existing.id, status: 'unpaid' },
        });
      }

      const remaining = await this.computeRemaining(
        tx,
        current,
        allocation.event.ticketCapacity,
        caller.id,
        maxPerUser,
      );

      if (input.quantity > remaining) {
        throw new BadRequestException({
          message: 'Requested quantity exceeds remaining capacity',
          remaining,
        });
      }

      const amounts = computePurchaseAmounts(
        input.quantity,
        unitPriceCents,
        feePercent,
      );
      assertPurchaseAmountInvariant(amounts);

      if (existing) {
        for (let i = 0; i < input.quantity; i += 1) {
          await tx.ticket.create({
            data: {
              allocationId: allocation.id,
              credentialToken: randomBytes(32).toString('hex'),
              holderUserId: caller.id,
              status: 'unpaid',
              purchaseId: existing.id,
            },
          });
        }
        const updated = await tx.purchase.update({
          where: { id: existing.id },
          data: {
            quantity: input.quantity,
            subtotalCents: amounts.subtotalCents,
            feeCents: amounts.feeCents,
            amountCents: amounts.amountCents,
            netCents: amounts.netCents,
            currency: 'usd',
            statusMismatch: false,
          },
        });
        const tickets = await tx.ticket.findMany({
          where: { purchaseId: existing.id, status: 'unpaid' },
          select: { id: true },
        });
        return {
          kind: 'reuse' as const,
          purchase: updated,
          ticketIds: tickets.map((t) => t.id),
          amounts,
          unitPriceCents,
        };
      }

      const purchase = await tx.purchase.create({
        data: {
          buyerUserId: caller.id,
          eventId: allocation.eventId,
          allocationId: allocation.id,
          quantity: input.quantity,
          subtotalCents: amounts.subtotalCents,
          feeCents: amounts.feeCents,
          amountCents: amounts.amountCents,
          netCents: amounts.netCents,
          currency: 'usd',
          status: 'requires_payment',
          stripePaymentIntentId: `pending-${randomBytes(16).toString('hex')}`,
        },
      });

      for (let i = 0; i < input.quantity; i += 1) {
        await tx.ticket.create({
          data: {
            allocationId: allocation.id,
            credentialToken: randomBytes(32).toString('hex'),
            holderUserId: caller.id,
            status: 'unpaid',
            purchaseId: purchase.id,
          },
        });
      }

      const tickets = await tx.ticket.findMany({
        where: { purchaseId: purchase.id, status: 'unpaid' },
        select: { id: true },
      });

      return {
        kind: 'new' as const,
        purchase,
        ticketIds: tickets.map((t) => t.id),
        amounts,
        unitPriceCents,
      };
    });

    try {
      if (reserved.kind === 'reuse') {
        if (reserved.purchase.stripePaymentIntentId.startsWith('pending-')) {
          const pi = await this.stripe.createPaymentIntent({
            amountCents: reserved.amounts.amountCents,
            currency: 'usd',
            metadata: {
              purchaseId: reserved.purchase.id,
              eventId: reserved.purchase.eventId,
              quantity: String(reserved.purchase.quantity),
            },
            idempotencyKey: `purchase-checkout-${reserved.purchase.id}`,
          });
          if (!pi.client_secret) {
            throw new BadRequestException('PaymentIntent missing client secret');
          }
          await this.prisma.purchase.update({
            where: { id: reserved.purchase.id },
            data: { stripePaymentIntentId: pi.id },
          });
          return {
            purchaseId: reserved.purchase.id,
            clientSecret: pi.client_secret,
            quantity: reserved.purchase.quantity,
            unitPriceCents: reserved.unitPriceCents,
            subtotalCents: reserved.amounts.subtotalCents,
            feeCents: reserved.amounts.feeCents,
            amountCents: reserved.amounts.amountCents,
            currency: 'usd',
            ticketIds: reserved.ticketIds,
          };
        }

        let pi = await this.stripe.retrievePaymentIntent(
          reserved.purchase.stripePaymentIntentId,
        );
        if (pi.amount !== reserved.amounts.amountCents) {
          pi = await this.stripe.updatePaymentIntentAmount(
            pi.id,
            reserved.amounts.amountCents,
          );
        }
        if (!pi.client_secret) {
          throw new BadRequestException('PaymentIntent missing client secret');
        }
        return {
          purchaseId: reserved.purchase.id,
          clientSecret: pi.client_secret,
          quantity: reserved.purchase.quantity,
          unitPriceCents: reserved.unitPriceCents,
          subtotalCents: reserved.amounts.subtotalCents,
          feeCents: reserved.amounts.feeCents,
          amountCents: reserved.amounts.amountCents,
          currency: 'usd',
          ticketIds: reserved.ticketIds,
        };
      }

      const pi = await this.stripe.createPaymentIntent({
        amountCents: reserved.amounts.amountCents,
        currency: 'usd',
        metadata: {
          purchaseId: reserved.purchase.id,
          eventId: reserved.purchase.eventId,
          quantity: String(reserved.purchase.quantity),
        },
        idempotencyKey: `purchase-checkout-${reserved.purchase.id}`,
      });
      if (!pi.client_secret) {
        throw new BadRequestException('PaymentIntent missing client secret');
      }

      await this.prisma.purchase.update({
        where: { id: reserved.purchase.id },
        data: { stripePaymentIntentId: pi.id },
      });

      return {
        purchaseId: reserved.purchase.id,
        clientSecret: pi.client_secret,
        quantity: reserved.purchase.quantity,
        unitPriceCents: reserved.unitPriceCents,
        subtotalCents: reserved.amounts.subtotalCents,
        feeCents: reserved.amounts.feeCents,
        amountCents: reserved.amounts.amountCents,
        currency: 'usd',
        ticketIds: reserved.ticketIds,
      };
    } catch (err) {
      if (reserved.kind === 'new') {
        await this.releaseReservedPurchase(reserved.purchase.id, {
          cancelStripe: false,
        });
      }
      throw err;
    }
  }

  /**
   * Cancel open Purchase: optional PI cancel, status canceled, DELETE unpaid tickets.
   * Idempotent when purchase already terminal.
   */
  async releaseReservedPurchase(
    purchaseId: string,
    options: { cancelStripe: boolean; status?: 'canceled' | 'failed' } = {
      cancelStripe: true,
      status: 'canceled',
    },
  ): Promise<void> {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) {
      return;
    }
    if (purchase.status !== 'requires_payment') {
      return;
    }

    if (
      options.cancelStripe &&
      !purchase.stripePaymentIntentId.startsWith('pending-')
    ) {
      try {
        await this.stripe.cancelPaymentIntent(purchase.stripePaymentIntentId);
      } catch (err) {
        this.logger.warn(
          `Failed to cancel PaymentIntent ${purchase.stripePaymentIntentId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.purchase.findUnique({ where: { id: purchaseId } });
      if (!locked || locked.status !== 'requires_payment') {
        return;
      }
      await tx.ticket.deleteMany({
        where: { purchaseId, status: 'unpaid' },
      });
      await tx.purchase.update({
        where: { id: purchaseId },
        data: { status: options.status ?? 'canceled' },
      });
    });
  }

  async sweepExpiredPurchases(): Promise<number> {
    const ttlMinutes = this.config.get('PURCHASE_TTL_MINUTES', { infer: true });
    const cutoff = new Date(Date.now() - ttlMinutes * 60_000);
    const expired = await this.prisma.purchase.findMany({
      where: {
        status: 'requires_payment',
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    });

    let released = 0;
    for (const row of expired) {
      await this.releaseReservedPurchase(row.id, {
        cancelStripe: true,
        status: 'canceled',
      });
      released += 1;
    }
    return released;
  }

  private async computeRemaining(
    tx: Prisma.TransactionClient,
    allocation: AllocationLockRow,
    ticketCapacity: number | null,
    buyerUserId: string,
    maxPerUser: number,
  ): Promise<number> {
    const allocationIssued = await tx.ticket.count({
      where: { allocationId: allocation.id, status: { not: 'void' } },
    });
    const allocationRemaining = Math.max(
      0,
      allocation.quantity - allocationIssued,
    );

    let eventRemaining = allocationRemaining;
    if (ticketCapacity != null) {
      const eventIssued = await tx.ticket.count({
        where: {
          status: { not: 'void' },
          allocation: { eventId: allocation.eventId },
        },
      });
      eventRemaining = Math.max(0, ticketCapacity - eventIssued);
    }

    const userHeld = await tx.ticket.count({
      where: {
        holderUserId: buyerUserId,
        status: { not: 'void' },
        allocation: { eventId: allocation.eventId },
      },
    });
    const userHeadroom = Math.max(0, maxPerUser - userHeld);

    return Math.min(allocationRemaining, eventRemaining, userHeadroom);
  }

  private async assertBuyerEligible(
    allocation: {
      organizationId: string | null;
    },
    caller: PublicUser,
  ): Promise<void> {
    if (allocation.organizationId === null) {
      return;
    }
    const membership = await this.prisma.membership.findUnique({
      where: { userId: caller.id },
      select: { organizationId: true },
    });
    if (membership?.organizationId === allocation.organizationId) {
      return;
    }
    throw new ForbiddenException('Not eligible for this allocation');
  }

  private assertCheckoutPreconditions(allocation: {
    status: string;
    priceCents: number | null;
    event: {
      ticketingEnabled: boolean;
      ticketSaleStatus: string | null;
      organization: { stripeChargesEnabled: boolean };
    };
  }): void {
    const { event } = allocation;
    if (!event.ticketingEnabled) {
      throw new BadRequestException('Ticketing is not enabled for this event');
    }
    if (event.ticketSaleStatus !== 'on_sale') {
      throw new BadRequestException('Ticket sales are not open');
    }
    if (allocation.status !== 'active') {
      throw new BadRequestException('Allocation is closed');
    }
    if ((allocation.priceCents ?? 0) <= 0) {
      throw new BadRequestException('Free tickets do not require checkout');
    }
    if (!event.organization.stripeChargesEnabled) {
      throw new UnprocessableEntityException({
        code: 'CONNECT_REQUIRED',
        message:
          'Host organization must complete Stripe Connect before checkout',
      });
    }
  }
}
