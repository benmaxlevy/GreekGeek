import {
  BadRequestException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { MembershipsService } from '../memberships/memberships.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PermissionsService } from '../permissions/permissions.service';
import { UniversitiesService } from '../universities/universities.service';
import type { PublicUser } from '../auth/types/auth.dto';
import { PurchasesService } from './purchases.service';
import { TicketsService } from './tickets.service';

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)('Purchases checkout integration', () => {
  const prisma = new PrismaClient();
  const universities = new UniversitiesService(prisma as never);
  const organizations = new OrganizationsService(prisma as never);
  const memberships = new MembershipsService(prisma as never);
  const permissions = new PermissionsService(prisma as never);
  const events = new EventsService(prisma as never);

  const stripe = {
    cancelPaymentIntent: jest.fn().mockResolvedValue({ id: 'pi_cancel' }),
    createPaymentIntent: jest.fn(),
    retrievePaymentIntent: jest.fn(),
    updatePaymentIntentAmount: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'RALLY_FEE_PERCENT') return 10;
      if (key === 'MAX_TICKETS_PER_USER_PER_EVENT') return 2;
      if (key === 'PURCHASE_TTL_MINUTES') return 5;
      return 10;
    }),
  };

  const purchases = new PurchasesService(prisma as never, stripe as never, config as never);
  const tickets = new TicketsService(prisma as never, config as never, purchases);

  const suffix = Date.now();
  let universityId = '';
  let hostOrgId = '';
  let hostManagerId = '';
  let buyerAId = '';
  let buyerBId = '';
  let eventId = '';
  let paidAllocId = '';
  let publicAllocId = '';

  function asUser(id: string, role: 'USER' | 'ADMIN' = 'USER'): PublicUser {
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

  async function cleanupEventTickets() {
    await prisma.ticket.deleteMany({
      where: { allocation: { eventId } },
    });
    await prisma.purchase.deleteMany({ where: { eventId } });
  }

  beforeAll(async () => {
    for (const key of ['events.create', 'events.manage', 'tickets.manage'] as const) {
      await prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key },
      });
    }

    const uni = await universities.create({
      name: `Purchase Uni ${suffix}`,
    });
    universityId = uni.id;
    hostOrgId = (
      await organizations.create({
        name: `Purchase Host ${suffix}`,
        type: 'FRATERNITY',
        universityId,
      })
    ).id;

    await prisma.organization.update({
      where: { id: hostOrgId },
      data: { stripeChargesEnabled: true },
    });

    hostManagerId = (
      await prisma.user.create({
        data: {
          email: `purchase-host-${suffix}@example.com`,
          name: 'Host',
          passwordHash: 'x',
          status: 'ACTIVE',
        },
      })
    ).id;
    buyerAId = (
      await prisma.user.create({
        data: {
          email: `purchase-a-${suffix}@example.com`,
          name: 'Buyer A',
          passwordHash: 'x',
          status: 'ACTIVE',
        },
      })
    ).id;
    buyerBId = (
      await prisma.user.create({
        data: {
          email: `purchase-b-${suffix}@example.com`,
          name: 'Buyer B',
          passwordHash: 'x',
          status: 'ACTIVE',
        },
      })
    ).id;

    const hostMembership = await memberships.assign({
      userId: hostManagerId,
      organizationId: hostOrgId,
    });
    for (const permissionKey of ['events.create', 'events.manage', 'tickets.manage'] as const) {
      await permissions.grant(hostMembership.id, { permissionKey });
    }

    // Buyers are org members so they can buy host allocation
    await memberships.assign({
      userId: buyerAId,
      organizationId: hostOrgId,
    });
    await memberships.assign({
      userId: buyerBId,
      organizationId: hostOrgId,
    });

    const event = await events.create(
      {
        organizationId: hostOrgId,
        name: `Purchase Event ${suffix}`,
        type: 'Formal',
        maxHeadcount: 50,
        startsAt: '2026-08-10T18:00:00.000Z',
      },
      asUser(hostManagerId),
    );
    eventId = event.id;

    await tickets.patchTicketing(
      eventId,
      {
        ticketingEnabled: true,
        ticketCapacity: 10,
        ticketSaleStatus: 'draft',
      },
      asUser(hostManagerId),
    );
    const paidAlloc = await tickets.createAllocation(
      eventId,
      { organizationId: hostOrgId, quantity: 6, priceCents: 1000 },
      asUser(hostManagerId),
    );
    paidAllocId = Array.isArray(paidAlloc) ? paidAlloc[0]!.id : paidAlloc.id;
    const publicAlloc = await tickets.createAllocation(
      eventId,
      { organizationId: null, quantity: 4, priceCents: 1000 },
      asUser(hostManagerId),
    );
    publicAllocId = Array.isArray(publicAlloc) ? publicAlloc[0]!.id : publicAlloc.id;
    await tickets.patchTicketing(eventId, { ticketSaleStatus: 'on_sale' }, asUser(hostManagerId));
  });

  afterAll(async () => {
    await cleanupEventTickets();
    await prisma.ticketAllocation.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.memberPermission.deleteMany({
      where: { membership: { organizationId: hostOrgId } },
    });
    await prisma.membership.deleteMany({
      where: { organizationId: hostOrgId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [hostManagerId, buyerAId, buyerBId] } },
    });
    await prisma.organization.deleteMany({ where: { id: hostOrgId } });
    await prisma.university.delete({ where: { id: universityId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupEventTickets();
    stripe.createPaymentIntent.mockReset();
    stripe.retrievePaymentIntent.mockReset();
    stripe.updatePaymentIntentAmount.mockReset();
    stripe.cancelPaymentIntent.mockReset();
    stripe.cancelPaymentIntent.mockResolvedValue({ id: 'pi_cancel' });
    stripe.createPaymentIntent.mockImplementation(async (input: { amountCents: number }) => ({
      id: `pi_${suffix}_${input.amountCents}_${Math.random().toString(36).slice(2, 8)}`,
      client_secret: `cs_${suffix}`,
      amount: input.amountCents,
    }));
  });

  it('checkout reserves N tickets with fee on subtotal', async () => {
    const result = await purchases.checkout(
      { allocationId: paidAllocId, quantity: 2 },
      asUser(buyerAId),
    );
    expect(result.quantity).toBe(2);
    expect(result.unitPriceCents).toBe(1000);
    expect(result.subtotalCents).toBe(2000);
    expect(result.feeCents).toBe(200);
    expect(result.amountCents).toBe(2200);
    expect(result.ticketIds).toHaveLength(2);
    expect(result.clientSecret).toBeTruthy();

    const held = await prisma.ticket.count({
      where: { purchaseId: result.purchaseId, status: 'unpaid' },
    });
    expect(held).toBe(2);

    expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 2200,
        metadata: expect.objectContaining({
          purchaseId: result.purchaseId,
          eventId,
          quantity: '2',
        }),
        idempotencyKey: `purchase-checkout-${result.purchaseId}`,
      }),
    );
  });

  it('reuses open requires_payment for same buyer+allocation', async () => {
    const first = await purchases.checkout(
      { allocationId: paidAllocId, quantity: 1 },
      asUser(buyerAId),
    );
    stripe.retrievePaymentIntent.mockResolvedValue({
      id: (
        await prisma.purchase.findUniqueOrThrow({
          where: { id: first.purchaseId },
        })
      ).stripePaymentIntentId,
      client_secret: `cs_reused_${suffix}`,
      amount: 1100,
    });

    const again = await purchases.checkout(
      { allocationId: paidAllocId, quantity: 1 },
      asUser(buyerAId),
    );
    expect(again.purchaseId).toBe(first.purchaseId);
    expect(again.clientSecret).toBe(`cs_reused_${suffix}`);
    expect(stripe.createPaymentIntent).toHaveBeenCalledTimes(1);
  });

  it('ineligible caller including ADMIN gets 403', async () => {
    await expect(
      purchases.checkout(
        { allocationId: paidAllocId, quantity: 1 },
        asUser('admin-purchase', 'ADMIN'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('rejects when charges disabled / not on sale / free alloc', async () => {
    await prisma.organization.update({
      where: { id: hostOrgId },
      data: { stripeChargesEnabled: false },
    });
    try {
      await expect(
        purchases.checkout({ allocationId: paidAllocId, quantity: 1 }, asUser(buyerAId)),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    } finally {
      await prisma.organization.update({
        where: { id: hostOrgId },
        data: { stripeChargesEnabled: true },
      });
    }

    await tickets.patchTicketing(eventId, { ticketSaleStatus: 'closed' }, asUser(hostManagerId));
    try {
      await expect(
        purchases.checkout({ allocationId: paidAllocId, quantity: 1 }, asUser(buyerAId)),
      ).rejects.toBeInstanceOf(BadRequestException);
    } finally {
      await tickets.patchTicketing(eventId, { ticketSaleStatus: 'on_sale' }, asUser(hostManagerId));
    }

    await prisma.ticketAllocation.update({
      where: { id: publicAllocId },
      data: { priceCents: 0 },
    });
    try {
      await expect(
        purchases.checkout({ allocationId: publicAllocId, quantity: 1 }, asUser(buyerAId)),
      ).rejects.toBeInstanceOf(BadRequestException);
    } finally {
      await prisma.ticketAllocation.update({
        where: { id: publicAllocId },
        data: { priceCents: 1000 },
      });
    }
  });

  it('over-request rejected with remaining count; per-user cap enforced', async () => {
    await expect(
      purchases.checkout({ allocationId: paidAllocId, quantity: 100 }, asUser(buyerAId)),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ remaining: expect.any(Number) }),
    });

    const atCap = await purchases.checkout(
      { allocationId: paidAllocId, quantity: 2 },
      asUser(buyerAId),
    );
    // Settle so next checkout cannot reuse open purchase
    await prisma.ticket.updateMany({
      where: { purchaseId: atCap.purchaseId },
      data: { status: 'paid', paidAt: new Date() },
    });
    await prisma.purchase.update({
      where: { id: atCap.purchaseId },
      data: { status: 'succeeded' },
    });

    await expect(
      purchases.checkout({ allocationId: paidAllocId, quantity: 1 }, asUser(buyerAId)),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ remaining: 0 }),
    });
  });

  it('held unpaid seats block other buyers (remaining 0)', async () => {
    // Cap allocation remaining by filling most seats via A holding all 6
    await prisma.ticketAllocation.update({
      where: { id: paidAllocId },
      data: { quantity: 2 },
    });
    config.get.mockImplementation((key: string) => {
      if (key === 'MAX_TICKETS_PER_USER_PER_EVENT') return 10;
      if (key === 'RALLY_FEE_PERCENT') return 10;
      if (key === 'PURCHASE_TTL_MINUTES') return 5;
      return 10;
    });

    await purchases.checkout({ allocationId: paidAllocId, quantity: 2 }, asUser(buyerAId));

    await expect(
      purchases.checkout({ allocationId: paidAllocId, quantity: 1 }, asUser(buyerBId)),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ remaining: 0 }),
    });

    const bTickets = await prisma.ticket.count({
      where: { holderUserId: buyerBId, allocationId: paidAllocId },
    });
    expect(bTickets).toBe(0);

    // restore
    await prisma.ticketAllocation.update({
      where: { id: paidAllocId },
      data: { quantity: 6 },
    });
    config.get.mockImplementation((key: string) => {
      if (key === 'RALLY_FEE_PERCENT') return 10;
      if (key === 'MAX_TICKETS_PER_USER_PER_EVENT') return 2;
      if (key === 'PURCHASE_TTL_MINUTES') return 5;
      return 10;
    });
  });

  it('concurrent checkouts cannot oversell allocation', async () => {
    await prisma.ticketAllocation.update({
      where: { id: paidAllocId },
      data: { quantity: 2 },
    });
    config.get.mockImplementation((key: string) => {
      if (key === 'MAX_TICKETS_PER_USER_PER_EVENT') return 10;
      if (key === 'RALLY_FEE_PERCENT') return 10;
      if (key === 'PURCHASE_TTL_MINUTES') return 5;
      return 10;
    });

    const results = await Promise.allSettled([
      purchases.checkout({ allocationId: paidAllocId, quantity: 2 }, asUser(buyerAId)),
      purchases.checkout({ allocationId: paidAllocId, quantity: 2 }, asUser(buyerBId)),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const unpaid = await prisma.ticket.count({
      where: { allocationId: paidAllocId, status: 'unpaid' },
    });
    expect(unpaid).toBe(2);

    await prisma.ticketAllocation.update({
      where: { id: paidAllocId },
      data: { quantity: 6 },
    });
    config.get.mockImplementation((key: string) => {
      if (key === 'RALLY_FEE_PERCENT') return 10;
      if (key === 'MAX_TICKETS_PER_USER_PER_EVENT') return 2;
      if (key === 'PURCHASE_TTL_MINUTES') return 5;
      return 10;
    });
  });

  it('TTL sweep cancels PI and deletes unpaid reserved tickets', async () => {
    const result = await purchases.checkout(
      { allocationId: paidAllocId, quantity: 1 },
      asUser(buyerAId),
    );
    await prisma.purchase.update({
      where: { id: result.purchaseId },
      data: { createdAt: new Date(Date.now() - 10 * 60_000) },
    });

    const released = await purchases.sweepExpiredPurchases();
    expect(released).toBeGreaterThanOrEqual(1);
    expect(stripe.cancelPaymentIntent).toHaveBeenCalled();

    const purchase = await prisma.purchase.findUnique({
      where: { id: result.purchaseId },
    });
    expect(purchase?.status).toBe('canceled');
    const ticketsLeft = await prisma.ticket.count({
      where: { purchaseId: result.purchaseId },
    });
    expect(ticketsLeft).toBe(0);

    // idempotent replay
    await expect(purchases.sweepExpiredPurchases()).resolves.toBe(0);
  });

  it('void unpaid on open purchase cancels whole purchase; void paid leaves totals', async () => {
    const result = await purchases.checkout(
      { allocationId: paidAllocId, quantity: 2 },
      asUser(buyerAId),
    );
    const [t1] = result.ticketIds;
    await tickets.voidTicket(t1!, asUser(hostManagerId));
    expect(stripe.cancelPaymentIntent).toHaveBeenCalled();

    const purchase = await prisma.purchase.findUnique({
      where: { id: result.purchaseId },
    });
    expect(purchase?.status).toBe('canceled');
    expect(await prisma.ticket.count({ where: { purchaseId: result.purchaseId } })).toBe(0);

    // succeeded purchase: void one paid ticket, totals unchanged
    const paid = await purchases.checkout(
      { allocationId: paidAllocId, quantity: 2 },
      asUser(buyerAId),
    );
    await prisma.ticket.updateMany({
      where: { purchaseId: paid.purchaseId },
      data: { status: 'paid', paidAt: new Date() },
    });
    await prisma.purchase.update({
      where: { id: paid.purchaseId },
      data: { status: 'succeeded' },
    });
    const before = await prisma.purchase.findUniqueOrThrow({
      where: { id: paid.purchaseId },
    });
    await tickets.voidTicket(paid.ticketIds[0]!, asUser(hostManagerId));
    const after = await prisma.purchase.findUniqueOrThrow({
      where: { id: paid.purchaseId },
    });
    expect(after.quantity).toBe(before.quantity);
    expect(after.amountCents).toBe(before.amountCents);
    expect(after.subtotalCents).toBe(before.subtotalCents);
    expect(after.feeCents).toBe(before.feeCents);
    expect(after.netCents).toBe(before.netCents);
  });

  it('legacy quantity=1 purchase keeps paidAt and credentialToken (migration shape)', async () => {
    const result = await purchases.checkout(
      { allocationId: paidAllocId, quantity: 1 },
      asUser(buyerAId),
    );
    const paidAt = new Date();
    await prisma.ticket.updateMany({
      where: { purchaseId: result.purchaseId },
      data: { status: 'paid', paidAt },
    });
    await prisma.purchase.update({
      where: { id: result.purchaseId },
      data: {
        status: 'succeeded',
        quantity: 1,
      },
    });

    const ticket = await prisma.ticket.findFirstOrThrow({
      where: { purchaseId: result.purchaseId },
    });
    expect(ticket.paidAt?.getTime()).toBe(paidAt.getTime());
    expect(ticket.credentialToken.length).toBeGreaterThan(10);
    expect(ticket.purchaseId).toBe(result.purchaseId);

    const mine = await tickets.listMine(asUser(buyerAId));
    const row = mine.find((t) => t.id === ticket.id);
    expect(row?.paidAt).toBeTruthy();
    expect(row?.credentialToken).toBe(ticket.credentialToken);
  });
});
