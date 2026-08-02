import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicUser } from '../auth/types/auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  toEventDto,
  type CreateEvent,
  type Event,
  type ListEventsQuery,
  type UpdateEvent,
} from './types/events.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListEventsQuery, caller: PublicUser): Promise<Event[]> {
    const organizationId = await this.resolveListOrganizationId(query, caller);
    const rows = await this.prisma.event.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        ...(query.ticketingEnabled === true ? { ticketingEnabled: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toEventDto);
  }

  async get(id: string, caller: PublicUser): Promise<Event> {
    const row = await this.prisma.event.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Event not found');
    }
    await this.assertCanViewEvent(row, caller);
    return toEventDto(row);
  }

  async create(input: CreateEvent, caller: PublicUser): Promise<Event> {
    const org = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
    });
    if (!org) {
      throw new BadRequestException('Organization not found');
    }
    // OrgPermissionGuard already enforced events.create + org match for non-ADMIN.
    // ADMIN bypasses guard; still validate org exists above.
    if (caller.role !== 'ADMIN') {
      await this.assertMemberOfOrg(input.organizationId, caller.id);
    }
    const row = await this.prisma.event.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        type: input.type,
        maxHeadcount: input.maxHeadcount,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        location: input.location ?? null,
      },
    });
    return toEventDto(row);
  }

  async update(id: string, input: UpdateEvent, caller: PublicUser): Promise<Event> {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Event not found');
    }
    await this.assertCanManageOrg(existing.organizationId, caller);
    const row = await this.prisma.event.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.maxHeadcount !== undefined ? { maxHeadcount: input.maxHeadcount } : {}),
        startsAt: new Date(input.startsAt),
        ...(input.endsAt !== undefined
          ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
          : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
      },
    });
    return toEventDto(row);
  }

  async hold(id: string, reason: string, caller: PublicUser): Promise<Event> {
    if (caller.role !== 'ADMIN') {
      throw new ForbiddenException('Payout operations require ADMIN');
    }
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Event not found');
    }
    const heldAt = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id },
        data: { heldAt, heldByUserId: caller.id },
      });
      await tx.eventPayoutAudit.create({
        data: { eventId: id, actorUserId: caller.id, action: 'hold', reason },
      });
      return updated;
    });
    return toEventDto(row);
  }

  async clearHold(id: string, reason: string, caller: PublicUser): Promise<Event> {
    if (caller.role !== 'ADMIN') {
      throw new ForbiddenException('Payout operations require ADMIN');
    }
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Event not found');
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id },
        data: { heldAt: null, heldByUserId: null },
      });
      await tx.eventPayoutAudit.create({
        data: { eventId: id, actorUserId: caller.id, action: 'clear', reason },
      });
      return updated;
    });
    return toEventDto(row);
  }

  async remove(id: string, caller: PublicUser): Promise<void> {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Event not found');
    }
    await this.assertCanManageOrg(existing.organizationId, caller);
    await this.prisma.event.delete({ where: { id } });
  }

  private async resolveListOrganizationId(
    query: ListEventsQuery,
    caller: PublicUser,
  ): Promise<string | undefined> {
    if (caller.role === 'ADMIN') {
      return query.organizationId;
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId: caller.id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!membership) {
      throw new ForbiddenException('Missing organization permission');
    }
    const keys = new Set(membership.permissions.map((p) => p.permission.key));
    if (
      !keys.has('events.create') &&
      !keys.has('events.manage') &&
      !keys.has('tickets.manage') &&
      !keys.has('tickets.scan')
    ) {
      throw new ForbiddenException('Missing organization permission');
    }
    if (query.organizationId && query.organizationId !== membership.organizationId) {
      throw new ForbiddenException('Missing organization permission');
    }
    return membership.organizationId;
  }

  private async assertCanViewEvent(
    event: { id: string; organizationId: string },
    caller: PublicUser,
  ): Promise<void> {
    if (caller.role === 'ADMIN') {
      return;
    }
    const membership = await this.prisma.membership.findUnique({
      where: { userId: caller.id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!membership) {
      throw new ForbiddenException('Missing organization permission');
    }
    const keys = new Set(membership.permissions.map((p) => p.permission.key));
    const isHostMember = membership.organizationId === event.organizationId;
    if (
      isHostMember &&
      (keys.has('events.create') ||
        keys.has('events.manage') ||
        keys.has('tickets.manage') ||
        keys.has('tickets.scan'))
    ) {
      return;
    }
    if (keys.has('tickets.manage')) {
      const invitedAlloc = await this.prisma.ticketAllocation.findFirst({
        where: {
          eventId: event.id,
          organizationId: membership.organizationId,
        },
        select: { id: true },
      });
      if (invitedAlloc) {
        return;
      }
    }
    throw new ForbiddenException('Missing organization permission');
  }

  private async assertCanManageOrg(organizationId: string, caller: PublicUser): Promise<void> {
    if (caller.role === 'ADMIN') {
      return;
    }
    const membership = await this.prisma.membership.findUnique({
      where: { userId: caller.id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!membership || membership.organizationId !== organizationId) {
      throw new ForbiddenException('Missing organization permission');
    }
    const hasManage = membership.permissions.some((p) => p.permission.key === 'events.manage');
    if (!hasManage) {
      throw new ForbiddenException('Missing organization permission');
    }
  }

  private async assertMemberOfOrg(organizationId: string, userId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId },
    });
    if (!membership || membership.organizationId !== organizationId) {
      throw new ForbiddenException('Missing organization permission');
    }
  }
}
