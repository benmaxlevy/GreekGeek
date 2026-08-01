import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AllocationStatus,
  Event,
  TicketAllocation,
  TicketSaleStatus,
} from '@prisma/client';
import type { PublicUser } from '../auth/types/auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  toEventTicketingDto,
  toGuestListEntryDto,
  toMyTicketDto,
  toTicketAllocationDto,
  toTicketDto,
  type CreateTicketAllocation,
  type EventTicketing,
  type GuestListEntry,
  type IssueTicket,
  type ListTicketsQuery,
  type MyTicket,
  type PatchEventTicketing,
  type Ticket,
  type TicketAccessAction,
  type TicketAllocation as TicketAllocationDto,
  type UpdateTicketAllocation,
} from './types/ticketing.dto';

type MembershipWithPermissions = {
  organizationId: string;
  permissions: { permission: { key: string } }[];
};

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async patchTicketing(
    eventId: string,
    input: PatchEventTicketing,
    caller: PublicUser,
  ): Promise<EventTicketing> {
    const event = await this.requireEvent(eventId);
    await this.assertHostTicketManage(event, caller);

    const nextEnabled = input.ticketingEnabled ?? event.ticketingEnabled;
    const nextCapacity = input.ticketCapacity ?? event.ticketCapacity;
    const nextSaleStatus = input.ticketSaleStatus ?? event.ticketSaleStatus;

    if (nextEnabled && nextCapacity == null) {
      throw new BadRequestException(
        'ticketCapacity is required when ticketing is enabled',
      );
    }
    if (nextCapacity != null && nextCapacity > event.maxHeadcount) {
      throw new BadRequestException(
        'ticketCapacity must not exceed event maxHeadcount',
      );
    }
    if (nextSaleStatus === 'on_sale') {
      const allocationCount = await this.prisma.ticketAllocation.count({
        where: { eventId },
      });
      if (allocationCount < 1) {
        throw new BadRequestException(
          'At least one allocation is required before going on sale',
        );
      }
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(input.ticketingEnabled !== undefined
          ? { ticketingEnabled: input.ticketingEnabled }
          : {}),
        ...(input.ticketCapacity !== undefined
          ? { ticketCapacity: input.ticketCapacity }
          : {}),
        ...(input.ticketSaleStatus !== undefined
          ? { ticketSaleStatus: input.ticketSaleStatus }
          : {}),
        ...(input.ticketSalesOpenAt !== undefined
          ? {
              ticketSalesOpenAt: input.ticketSalesOpenAt
                ? new Date(input.ticketSalesOpenAt)
                : null,
            }
          : {}),
        ...(input.ticketSalesCloseAt !== undefined
          ? {
              ticketSalesCloseAt: input.ticketSalesCloseAt
                ? new Date(input.ticketSalesCloseAt)
                : null,
            }
          : {}),
      },
    });
    return toEventTicketingDto(updated);
  }

  async listAllocations(
    eventId: string,
    caller: PublicUser,
  ): Promise<TicketAllocationDto[]> {
    const event = await this.requireEvent(eventId);
    const membership = await this.loadMembership(caller);
    const isHost = await this.hasHostTicketManage(event, caller, membership);

    let organizationFilter: string | undefined;
    if (!isHost) {
      const invited = await this.getInvitedOrgAllocation(eventId, membership);
      if (!invited) {
        throw new ForbiddenException('Missing organization permission');
      }
      organizationFilter = membership!.organizationId;
    }

    const rows = await this.prisma.ticketAllocation.findMany({
      where: {
        eventId,
        ...(organizationFilter
          ? { organizationId: organizationFilter }
          : {}),
      },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
    const issuedCounts = await this.countIssuedByAllocation(
      rows.map((row) => row.id),
    );
    return rows.map((row) =>
      toTicketAllocationDto({
        ...row,
        issuedCount: issuedCounts.get(row.id) ?? 0,
      }),
    );
  }

  /** ACTIVE users: on_sale events with an active public allocation. */
  async listClaimableEvents(caller: PublicUser) {
    if (caller.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is not active');
    }
    return this.prisma.event.findMany({
      where: {
        ticketingEnabled: true,
        ticketSaleStatus: 'on_sale',
        allocations: {
          some: { organizationId: null, status: 'active' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAllocation(
    eventId: string,
    input: CreateTicketAllocation,
    caller: PublicUser,
  ): Promise<TicketAllocationDto | TicketAllocationDto[]> {
    const event = await this.requireEvent(eventId);
    await this.assertHostTicketManage(event, caller);
    await this.assertTicketingEnabled(event);

    if (input.allOrgs) {
      const orgs = await this.prisma.organization.findMany({
        select: { id: true },
      });
      const created: TicketAllocationDto[] = [];
      for (const org of orgs) {
        const row = await this.createSingleAllocation(event, {
          organizationId: org.id,
          quantity: input.quantity,
          priceCents: input.priceCents,
        });
        created.push(row);
      }
      return created;
    }

    return this.createSingleAllocation(event, {
      organizationId: input.organizationId ?? null,
      quantity: input.quantity,
      priceCents: input.priceCents,
    });
  }

  async updateAllocation(
    eventId: string,
    allocationId: string,
    input: UpdateTicketAllocation,
    caller: PublicUser,
  ): Promise<TicketAllocationDto> {
    const event = await this.requireEvent(eventId);
    await this.assertHostTicketManage(event, caller);
    const allocation = await this.requireAllocation(eventId, allocationId);

    if (input.quantity !== undefined) {
      await this.assertAllocationQuantityEdit(event, allocation, input.quantity);
      await this.assertCapacityForQuantityChange(
        event,
        allocation,
        input.quantity,
      );
    }

    const updated = await this.prisma.ticketAllocation.update({
      where: { id: allocationId },
      data: {
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.priceCents !== undefined
          ? { priceCents: input.priceCents }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: { organization: true },
    });
    const issuedCount = await this.prisma.ticket.count({
      where: { allocationId, status: { not: 'void' } },
    });
    return toTicketAllocationDto({
      ...updated,
      issuedCount,
    });
  }

  async issueTicket(
    eventId: string,
    allocationId: string,
    input: IssueTicket,
    caller: PublicUser,
  ): Promise<Ticket> {
    const event = await this.requireEvent(eventId);
    const allocation = await this.requireAllocation(eventId, allocationId);
    await this.assertTicketAccess(event, allocation, caller, 'issue');
    this.assertSalesOpen(event);
    if (allocation.status !== 'active') {
      throw new BadRequestException('Allocation is closed');
    }

    return this.createTicketInAllocation(allocationId, input.holderUserId ?? null);
  }

  async listTickets(
    eventId: string,
    query: ListTicketsQuery,
    caller: PublicUser,
  ): Promise<Ticket[]> {
    const event = await this.requireEvent(eventId);
    const membership = await this.loadMembership(caller);
    const isAdmin = caller.role === 'ADMIN';
    const isHost = await this.hasHostTicketManage(event, caller, membership);

    let scopedAllocationId = query.allocationId;
    if (!isAdmin && !isHost) {
      const invitedAllocation = await this.getInvitedOrgAllocation(
        eventId,
        membership,
      );
      if (!invitedAllocation) {
        throw new ForbiddenException('Missing organization permission');
      }
      if (scopedAllocationId && scopedAllocationId !== invitedAllocation.id) {
        throw new ForbiddenException('Missing organization permission');
      }
      scopedAllocationId = invitedAllocation.id;
      if (
        query.organizationId &&
        query.organizationId !== invitedAllocation.organizationId
      ) {
        throw new ForbiddenException('Missing organization permission');
      }
    } else if (query.organizationId) {
      const orgAllocation = await this.prisma.ticketAllocation.findFirst({
        where: { eventId, organizationId: query.organizationId },
      });
      if (!orgAllocation) {
        return [];
      }
      if (scopedAllocationId && scopedAllocationId !== orgAllocation.id) {
        return [];
      }
      scopedAllocationId = orgAllocation.id;
    }

    const rows = await this.prisma.ticket.findMany({
      where: {
        allocation: { eventId },
        ...(scopedAllocationId ? { allocationId: scopedAllocationId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: { allocation: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toTicketDto);
  }

  async guestList(eventId: string, caller: PublicUser): Promise<GuestListEntry[]> {
    const event = await this.requireEvent(eventId);
    await this.assertHostTicketManage(event, caller);

    const rows = await this.prisma.ticket.findMany({
      where: {
        status: 'paid',
        allocation: { eventId },
      },
      include: {
        holder: true,
        allocation: { include: { organization: true } },
      },
      orderBy: { paidAt: 'asc' },
    });

    return rows.map((row) =>
      toGuestListEntryDto({
        id: row.id,
        holderUserId: row.holderUserId,
        holderName: row.holder?.name ?? null,
        allocationLabel: row.allocation.organizationId
          ? (row.allocation.organization?.name ?? 'Organization')
          : 'Public',
        paidAt: row.paidAt!,
      }),
    );
  }

  async voidTicket(ticketId: string, caller: PublicUser): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { allocation: { include: { event: true } } },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    if (ticket.status === 'void') {
      throw new BadRequestException('Ticket is already void');
    }
    await this.assertTicketAccess(
      ticket.allocation.event,
      ticket.allocation,
      caller,
      'void',
    );

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'void', voidedAt: new Date() },
      include: { allocation: true },
    });
    return toTicketDto(updated);
  }

  async markPaid(ticketId: string, caller: PublicUser): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { allocation: { include: { event: true } } },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    if (ticket.status !== 'unpaid') {
      throw new BadRequestException('Only unpaid tickets can be marked paid');
    }

    const isHolder = ticket.holderUserId === caller.id;
    if (!isHolder) {
      await this.assertTicketAccess(
        ticket.allocation.event,
        ticket.allocation,
        caller,
        'mark_paid',
      );
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'paid', paidAt: new Date() },
      include: { allocation: true },
    });
    return toTicketDto(updated);
  }

  async publicClaim(eventId: string, caller: PublicUser): Promise<Ticket> {
    const event = await this.requireEvent(eventId);
    this.assertSalesOpen(event);

    const publicAllocation = await this.prisma.ticketAllocation.findFirst({
      where: { eventId, organizationId: null, status: 'active' },
    });
    if (!publicAllocation) {
      throw new BadRequestException('No active public allocation for this event');
    }

    const existing = await this.prisma.ticket.findFirst({
      where: {
        holderUserId: caller.id,
        status: { not: 'void' },
        allocation: { eventId },
      },
    });
    if (existing) {
      throw new ConflictException('You already hold a ticket for this event');
    }

    return this.createTicketInAllocation(publicAllocation.id, caller.id);
  }

  async listMine(caller: PublicUser): Promise<MyTicket[]> {
    const rows = await this.prisma.ticket.findMany({
      where: { holderUserId: caller.id },
      include: {
        allocation: { include: { organization: true, event: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) =>
      toMyTicketDto({
        ticket: row,
        event: row.allocation.event,
        allocation: row.allocation,
      }),
    );
  }

  private async createTicketInAllocation(
    allocationId: string,
    holderUserId: string | null,
  ): Promise<Ticket> {
    const ticket = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<TicketAllocation[]>`
        SELECT * FROM "TicketAllocation" WHERE id = ${allocationId} FOR UPDATE
      `;
      if (!locked.length || !locked[0]) {
        throw new NotFoundException('Allocation not found');
      }
      const current = locked[0];
      const issuedCount = await tx.ticket.count({
        where: { allocationId, status: { not: 'void' } },
      });
      if (issuedCount >= current.quantity) {
        throw new ConflictException('Allocation is sold out');
      }
      return tx.ticket.create({
        data: {
          allocationId,
          credentialToken: randomBytes(32).toString('hex'),
          holderUserId,
        },
        include: { allocation: true },
      });
    });
    return toTicketDto(ticket);
  }

  private async createSingleAllocation(
    event: Event,
    input: {
      organizationId: string | null;
      quantity: number;
      priceCents?: number;
    },
  ): Promise<TicketAllocationDto> {
    if (input.organizationId === null) {
      const existingPublic = await this.prisma.ticketAllocation.findFirst({
        where: { eventId: event.id, organizationId: null },
      });
      if (existingPublic) {
        throw new ConflictException('Public allocation already exists for event');
      }
    }

    const currentSum = await this.sumAllocationQuantities(event.id);
    if (currentSum + input.quantity > (event.ticketCapacity ?? 0)) {
      throw new BadRequestException(
        'Total allocation quantity would exceed ticket capacity',
      );
    }

    try {
      const row = await this.prisma.ticketAllocation.create({
        data: {
          eventId: event.id,
          organizationId: input.organizationId,
          quantity: input.quantity,
          priceCents: input.priceCents ?? null,
        },
        include: { organization: true },
      });
      return toTicketAllocationDto({
        ...row,
        issuedCount: 0,
      });
    } catch {
      throw new ConflictException('Allocation already exists for organization');
    }
  }

  private async countIssuedByAllocation(
    allocationIds: string[],
  ): Promise<Map<string, number>> {
    if (!allocationIds.length) {
      return new Map();
    }
    const grouped = await this.prisma.ticket.groupBy({
      by: ['allocationId'],
      where: {
        allocationId: { in: allocationIds },
        status: { not: 'void' },
      },
      _count: { _all: true },
    });
    return new Map(
      grouped.map((row) => [row.allocationId, row._count._all]),
    );
  }

  private async requireEvent(eventId: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  private async requireAllocation(
    eventId: string,
    allocationId: string,
  ): Promise<TicketAllocation> {
    const allocation = await this.prisma.ticketAllocation.findFirst({
      where: { id: allocationId, eventId },
    });
    if (!allocation) {
      throw new NotFoundException('Allocation not found');
    }
    return allocation;
  }

  private async assertTicketingEnabled(event: Event): Promise<void> {
    if (!event.ticketingEnabled || event.ticketCapacity == null) {
      throw new BadRequestException('Ticketing is not enabled for this event');
    }
  }

  private assertSalesOpen(event: Event): void {
    if (!event.ticketingEnabled || event.ticketSaleStatus !== 'on_sale') {
      throw new BadRequestException('Ticket sales are not open');
    }
    const now = new Date();
    if (event.ticketSalesOpenAt && now < event.ticketSalesOpenAt) {
      throw new BadRequestException('Ticket sales have not opened yet');
    }
    if (event.ticketSalesCloseAt && now > event.ticketSalesCloseAt) {
      throw new BadRequestException('Ticket sales have closed');
    }
  }

  private async sumAllocationQuantities(eventId: string): Promise<number> {
    const result = await this.prisma.ticketAllocation.aggregate({
      where: { eventId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  private async assertAllocationQuantityEdit(
    event: Event,
    allocation: TicketAllocation,
    nextQuantity: number,
  ): Promise<void> {
    if (event.ticketSaleStatus !== 'on_sale') {
      return;
    }
    const issuedCount = await this.prisma.ticket.count({
      where: { allocationId: allocation.id, status: { not: 'void' } },
    });
    if (nextQuantity < issuedCount) {
      throw new BadRequestException(
        'Allocation quantity cannot be below issued ticket count while on sale',
      );
    }
  }

  private async assertCapacityForQuantityChange(
    event: Event,
    allocation: TicketAllocation,
    nextQuantity: number,
  ): Promise<void> {
    const currentSum = await this.sumAllocationQuantities(event.id);
    const nextSum = currentSum - allocation.quantity + nextQuantity;
    if (event.ticketCapacity != null && nextSum > event.ticketCapacity) {
      throw new BadRequestException(
        'Total allocation quantity would exceed ticket capacity',
      );
    }
  }

  private async loadMembership(
    caller: PublicUser,
  ): Promise<MembershipWithPermissions | null> {
    if (caller.role === 'ADMIN') {
      return null;
    }
    return this.prisma.membership.findUnique({
      where: { userId: caller.id },
      include: { permissions: { include: { permission: true } } },
    });
  }

  private hasPermission(
    membership: MembershipWithPermissions | null,
    permissionKey: string,
  ): boolean {
    if (!membership) {
      return false;
    }
    return membership.permissions.some(
      (p) => p.permission.key === permissionKey,
    );
  }

  private async hasHostTicketManage(
    event: Event,
    caller: PublicUser,
    membership: MembershipWithPermissions | null = null,
  ): Promise<boolean> {
    if (caller.role === 'ADMIN') {
      return true;
    }
    const m = membership ?? (await this.loadMembership(caller));
    return (
      m != null &&
      m.organizationId === event.organizationId &&
      this.hasPermission(m, 'tickets.manage')
    );
  }

  private async assertHostTicketManage(
    event: Event,
    caller: PublicUser,
  ): Promise<void> {
    if (await this.hasHostTicketManage(event, caller)) {
      return;
    }
    throw new ForbiddenException('Missing organization permission');
  }

  private async getInvitedOrgAllocation(
    eventId: string,
    membership: MembershipWithPermissions | null,
  ): Promise<TicketAllocation | null> {
    if (!membership || !this.hasPermission(membership, 'tickets.manage')) {
      return null;
    }
    return this.prisma.ticketAllocation.findFirst({
      where: {
        eventId,
        organizationId: membership.organizationId,
      },
    });
  }

  private async assertTicketAccess(
    event: Event,
    allocation: TicketAllocation,
    caller: PublicUser,
    action: TicketAccessAction,
  ): Promise<void> {
    if (caller.role === 'ADMIN') {
      return;
    }

    const membership = await this.loadMembership(caller);
    if (!membership) {
      throw new ForbiddenException('Missing organization permission');
    }

    const isHost =
      membership.organizationId === event.organizationId &&
      this.hasPermission(membership, 'tickets.manage');

    if (isHost) {
      return;
    }

    if (!this.hasPermission(membership, 'tickets.manage')) {
      throw new ForbiddenException('Missing organization permission');
    }

    if (action === 'claim') {
      return;
    }

    if (allocation.organizationId == null) {
      throw new ForbiddenException('Missing organization permission');
    }

    if (allocation.organizationId !== membership.organizationId) {
      throw new ForbiddenException('Missing organization permission');
    }
  }
}
