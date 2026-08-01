import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { MembershipsService } from '../memberships/memberships.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PermissionsService } from '../permissions/permissions.service';
import { UniversitiesService } from '../universities/universities.service';
import { TicketsService } from './tickets.service';
import type { PublicUser } from '../auth/types/auth.dto';

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)('Ticketing API integration', () => {
  const prisma = new PrismaClient();
  const universities = new UniversitiesService(prisma as never);
  const organizations = new OrganizationsService(prisma as never);
  const memberships = new MembershipsService(prisma as never);
  const permissions = new PermissionsService(prisma as never);
  const events = new EventsService(prisma as never);
  const tickets = new TicketsService(prisma as never);

  const suffix = Date.now();
  let universityId = '';
  let hostOrgId = '';
  let invitedOrgId = '';
  let hostManagerId = '';
  let invitedManagerId = '';
  let noPermUserId = '';
  let guestUserId = '';
  let eventId = '';
  let hostAllocId = '';
  let invitedAllocId = '';
  let publicAllocId = '';

  function asUser(
    id: string,
    role: 'USER' | 'ADMIN' = 'USER',
  ): PublicUser {
    return {
      id,
      email: `${id}@example.com`,
      name: 'Test',
      role,
      status: 'ACTIVE',
      requestedOrganizationId: null,
      membership: null,
      permissions: [],
    };
  }

  async function enableTicketingOnSale(allocQuantity = 5) {
    await tickets.patchTicketing(
      eventId,
      {
        ticketingEnabled: true,
        ticketCapacity: 20,
        ticketSaleStatus: 'draft',
      },
      asUser(hostManagerId),
    );
    const hostAlloc = await tickets.createAllocation(
      eventId,
      { organizationId: hostOrgId, quantity: allocQuantity },
      asUser(hostManagerId),
    );
    hostAllocId = (hostAlloc as { id: string }).id;
    const invitedAlloc = await tickets.createAllocation(
      eventId,
      { organizationId: invitedOrgId, quantity: allocQuantity },
      asUser(hostManagerId),
    );
    invitedAllocId = (invitedAlloc as { id: string }).id;
    const publicAlloc = await tickets.createAllocation(
      eventId,
      { organizationId: null, quantity: allocQuantity },
      asUser(hostManagerId),
    );
    publicAllocId = (publicAlloc as { id: string }).id;
    await tickets.patchTicketing(
      eventId,
      { ticketSaleStatus: 'on_sale' },
      asUser(hostManagerId),
    );
  }

  beforeAll(async () => {
    for (const key of [
      'events.create',
      'events.manage',
      'tickets.manage',
    ] as const) {
      await prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key },
      });
    }

    const uni = await universities.create({
      name: `Ticketing Test Uni ${suffix}`,
    });
    universityId = uni.id;
    hostOrgId = (
      await organizations.create({
        name: `Ticketing Host ${suffix}`,
        type: 'FRATERNITY',
        universityId,
      })
    ).id;
    invitedOrgId = (
      await organizations.create({
        name: `Ticketing Invited ${suffix}`,
        type: 'SORORITY',
        universityId,
      })
    ).id;

    const hostManager = await prisma.user.create({
      data: {
        email: `tkt-host-${suffix}@example.com`,
        name: 'Host Manager',
        passwordHash: 'x',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    hostManagerId = hostManager.id;
    const hostMembership = await memberships.assign({
      userId: hostManagerId,
      organizationId: hostOrgId,
    });
    await permissions.grant(hostMembership.id, {
      permissionKey: 'events.manage',
    });
    await permissions.grant(hostMembership.id, {
      permissionKey: 'tickets.manage',
    });

    const invitedManager = await prisma.user.create({
      data: {
        email: `tkt-invited-${suffix}@example.com`,
        name: 'Invited Manager',
        passwordHash: 'x',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    invitedManagerId = invitedManager.id;
    const invitedMembership = await memberships.assign({
      userId: invitedManagerId,
      organizationId: invitedOrgId,
    });
    await permissions.grant(invitedMembership.id, {
      permissionKey: 'tickets.manage',
    });

    const noPerm = await prisma.user.create({
      data: {
        email: `tkt-noperm-${suffix}@example.com`,
        name: 'No Perm',
        passwordHash: 'x',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    noPermUserId = noPerm.id;
    await memberships.assign({
      userId: noPermUserId,
      organizationId: hostOrgId,
    });

    const guest = await prisma.user.create({
      data: {
        email: `tkt-guest-${suffix}@example.com`,
        name: 'Guest',
        passwordHash: 'x',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    guestUserId = guest.id;

    const event = await events.create(
      {
        organizationId: hostOrgId,
        name: `Ticketing Event ${suffix}`,
        type: 'Formal',
        maxHeadcount: 50,
      },
      asUser(hostManagerId),
    );
    eventId = event.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({
      where: { allocation: { eventId } },
    });
    await prisma.ticketAllocation.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.memberPermission.deleteMany({
      where: {
        membership: {
          organizationId: { in: [hostOrgId, invitedOrgId] },
        },
      },
    });
    await prisma.membership.deleteMany({
      where: { organizationId: { in: [hostOrgId, invitedOrgId] } },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [hostManagerId, invitedManagerId, noPermUserId, guestUserId],
        },
      },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [hostOrgId, invitedOrgId] } },
    });
    await prisma.university.delete({ where: { id: universityId } });
    await prisma.$disconnect();
  });

  it('permission matrix: host, invited-org, no perm, admin', async () => {
    await enableTicketingOnSale();

    await expect(
      tickets.createAllocation(
        eventId,
        { organizationId: hostOrgId, quantity: 1 },
        asUser(invitedManagerId),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const invitedTicket = await tickets.issueTicket(
      eventId,
      invitedAllocId,
      {},
      asUser(invitedManagerId),
    );
    expect(invitedTicket.allocationId).toBe(invitedAllocId);

    await expect(
      tickets.issueTicket(
        eventId,
        publicAllocId,
        {},
        asUser(invitedManagerId),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      tickets.issueTicket(
        eventId,
        hostAllocId,
        {},
        asUser(invitedManagerId),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      tickets.issueTicket(eventId, hostAllocId, {}, asUser(noPermUserId)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const adminTicket = await tickets.issueTicket(
      eventId,
      hostAllocId,
      {},
      asUser('admin', 'ADMIN'),
    );
    expect(adminTicket.status).toBe('unpaid');
  });

  it('capacity, over-allocate, on_sale qty floor', async () => {
    const capEvent = await events.create(
      {
        organizationId: hostOrgId,
        name: `Capacity Event ${suffix}`,
        type: 'Party',
        maxHeadcount: 30,
      },
      asUser(hostManagerId),
    );

    await tickets.patchTicketing(
      capEvent.id,
      {
        ticketingEnabled: true,
        ticketCapacity: 25,
        ticketSaleStatus: 'draft',
      },
      asUser(hostManagerId),
    );

    await expect(
      tickets.patchTicketing(
        capEvent.id,
        { ticketCapacity: 100 },
        asUser(hostManagerId),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await tickets.createAllocation(
      capEvent.id,
      { organizationId: hostOrgId, quantity: 20 },
      asUser(hostManagerId),
    );

    await expect(
      tickets.createAllocation(
        capEvent.id,
        { organizationId: invitedOrgId, quantity: 10 },
        asUser(hostManagerId),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      tickets.patchTicketing(
        capEvent.id,
        { ticketSaleStatus: 'on_sale' },
        asUser(hostManagerId),
      ),
    ).resolves.toBeDefined();

    const capAlloc = await prisma.ticketAllocation.findFirst({
      where: { eventId: capEvent.id, organizationId: hostOrgId },
    });
    const issued = await tickets.issueTicket(
      capEvent.id,
      capAlloc!.id,
      {},
      asUser(hostManagerId),
    );

    await expect(
      tickets.updateAllocation(
        capEvent.id,
        capAlloc!.id,
        { quantity: 0 },
        asUser(hostManagerId),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await tickets.voidTicket(issued.id, asUser(hostManagerId));

    await tickets.updateAllocation(
      capEvent.id,
      capAlloc!.id,
      { quantity: 5 },
      asUser(hostManagerId),
    );

    await prisma.ticket.deleteMany({
      where: { allocation: { eventId: capEvent.id } },
    });
    await prisma.ticketAllocation.deleteMany({
      where: { eventId: capEvent.id },
    });
    await prisma.event.delete({ where: { id: capEvent.id } });
  });

  it('concurrent issue: only one succeeds on last slot', async () => {
    const raceEvent = await events.create(
      {
        organizationId: hostOrgId,
        name: `Race Event ${suffix}`,
        type: 'Rush',
        maxHeadcount: 10,
      },
      asUser(hostManagerId),
    );
    await tickets.patchTicketing(
      raceEvent.id,
      {
        ticketingEnabled: true,
        ticketCapacity: 1,
        ticketSaleStatus: 'draft',
      },
      asUser(hostManagerId),
    );
    const alloc = await tickets.createAllocation(
      raceEvent.id,
      { organizationId: hostOrgId, quantity: 1 },
      asUser(hostManagerId),
    );
    const allocId = (alloc as { id: string }).id;
    await tickets.patchTicketing(
      raceEvent.id,
      { ticketSaleStatus: 'on_sale' },
      asUser(hostManagerId),
    );

    const results = await Promise.allSettled([
      tickets.issueTicket(raceEvent.id, allocId, {}, asUser(hostManagerId)),
      tickets.issueTicket(raceEvent.id, allocId, {}, asUser(hostManagerId)),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(
      (rejected[0] as PromiseRejectedResult).reason,
    ).toBeInstanceOf(ConflictException);

    await prisma.ticket.deleteMany({
      where: { allocation: { eventId: raceEvent.id } },
    });
    await prisma.ticketAllocation.deleteMany({
      where: { eventId: raceEvent.id },
    });
    await prisma.event.delete({ where: { id: raceEvent.id } });
  });

  it('guest self-claim, holder mark-paid, guest list paid-only', async () => {
    const claimEvent = await events.create(
      {
        organizationId: hostOrgId,
        name: `Claim Event ${suffix}`,
        type: 'Social',
        maxHeadcount: 20,
      },
      asUser(hostManagerId),
    );
    await tickets.patchTicketing(
      claimEvent.id,
      {
        ticketingEnabled: true,
        ticketCapacity: 10,
        ticketSaleStatus: 'draft',
      },
      asUser(hostManagerId),
    );
    const publicAlloc = await tickets.createAllocation(
      claimEvent.id,
      { organizationId: null, quantity: 5 },
      asUser(hostManagerId),
    );
    const publicId = (publicAlloc as { id: string }).id;
    await tickets.patchTicketing(
      claimEvent.id,
      { ticketSaleStatus: 'on_sale' },
      asUser(hostManagerId),
    );

    const claimed = await tickets.publicClaim(claimEvent.id, asUser(guestUserId));
    expect(claimed.holderUserId).toBe(guestUserId);
    expect(claimed.status).toBe('unpaid');

    const unpaidGuestList = await tickets.guestList(
      claimEvent.id,
      asUser(hostManagerId),
    );
    expect(unpaidGuestList).toHaveLength(0);

    const paid = await tickets.markPaid(claimed.id, asUser(guestUserId));
    expect(paid.status).toBe('paid');

    const guestList = await tickets.guestList(
      claimEvent.id,
      asUser(hostManagerId),
    );
    expect(guestList).toHaveLength(1);
    expect(guestList[0]?.allocationLabel).toBe('Public');
    expect(guestList[0]?.holderUserId).toBe(guestUserId);

    const mine = await tickets.listMine(asUser(guestUserId));
    expect(mine.some((t) => t.id === claimed.id)).toBe(true);

    await prisma.ticket.deleteMany({
      where: { allocation: { eventId: claimEvent.id } },
    });
    await prisma.ticketAllocation.deleteMany({
      where: { eventId: claimEvent.id },
    });
    await prisma.event.delete({ where: { id: claimEvent.id } });
  });
});
