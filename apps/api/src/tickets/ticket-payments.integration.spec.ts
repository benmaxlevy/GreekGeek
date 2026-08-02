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
import { TicketPaymentsService } from './ticket-payments.service';
import { TicketsService } from './tickets.service';

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)(
  'TicketPayments checkout integration',
  () => {
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
      get: jest.fn().mockReturnValue(10),
    };

    const tickets = new TicketsService(prisma as never, stripe as never);
    const payments = new TicketPaymentsService(
      prisma as never,
      stripe as never,
      config as never,
    );

    const suffix = Date.now();
    let universityId = '';
    let hostOrgId = '';
    let hostManagerId = '';
    let holderUserId = '';
    let eventId = '';
    let paidAllocId = '';
    let freeAllocId = '';

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
        name: `Checkout Uni ${suffix}`,
      });
      universityId = uni.id;
      hostOrgId = (
        await organizations.create({
          name: `Checkout Host ${suffix}`,
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
            email: `checkout-host-${suffix}@example.com`,
            name: 'Host',
            passwordHash: 'x',
            status: 'ACTIVE',
          },
        })
      ).id;
      holderUserId = (
        await prisma.user.create({
          data: {
            email: `checkout-holder-${suffix}@example.com`,
            name: 'Holder',
            passwordHash: 'x',
            status: 'ACTIVE',
          },
        })
      ).id;

      const hostMembership = await memberships.assign({
        userId: hostManagerId,
        organizationId: hostOrgId,
      });
      for (const permissionKey of [
        'events.create',
        'events.manage',
        'tickets.manage',
      ] as const) {
        await permissions.grant(hostMembership.id, { permissionKey });
      }

      const event = await events.create(
        {
          organizationId: hostOrgId,
          name: `Checkout Event ${suffix}`,
          type: 'Formal',
          maxHeadcount: 50,
        },
        asUser(hostManagerId),
      );
      eventId = event.id;

      await tickets.patchTicketing(
        eventId,
        {
          ticketingEnabled: true,
          ticketCapacity: 20,
          ticketSaleStatus: 'draft',
        },
        asUser(hostManagerId),
      );
      paidAllocId = (
        await tickets.createAllocation(
          eventId,
          { organizationId: hostOrgId, quantity: 10, priceCents: 1000 },
          asUser(hostManagerId),
        )
      ).id;
      freeAllocId = (
        await tickets.createAllocation(
          eventId,
          { organizationId: null, quantity: 5, priceCents: 0 },
          asUser(hostManagerId),
        )
      ).id;
      await tickets.patchTicketing(
        eventId,
        { ticketSaleStatus: 'on_sale' },
        asUser(hostManagerId),
      );
    });

    afterAll(async () => {
      await prisma.ticketPayment.deleteMany({
        where: { ticket: { allocation: { eventId } } },
      });
      await prisma.ticket.deleteMany({
        where: { allocation: { eventId } },
      });
      await prisma.ticketAllocation.deleteMany({ where: { eventId } });
      await prisma.event.deleteMany({ where: { id: eventId } });
      await prisma.memberPermission.deleteMany({
        where: { membership: { organizationId: hostOrgId } },
      });
      await prisma.membership.deleteMany({
        where: { organizationId: hostOrgId },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [hostManagerId, holderUserId] } },
      });
      await prisma.organization.deleteMany({ where: { id: hostOrgId } });
      await prisma.university.delete({ where: { id: universityId } });
      await prisma.$disconnect();
    });

    beforeEach(async () => {
      await prisma.ticketPayment.deleteMany({
        where: { ticket: { allocation: { eventId } } },
      });
      await prisma.ticket.deleteMany({
        where: { allocation: { eventId } },
      });
      stripe.createPaymentIntent.mockReset();
      stripe.retrievePaymentIntent.mockReset();
      stripe.updatePaymentIntentAmount.mockReset();
      stripe.createPaymentIntent.mockResolvedValue({
        id: `pi_new_${suffix}`,
        client_secret: `cs_test_${suffix}`,
        amount: 1100,
      });
    });

    async function issueUnpaidForHolder() {
      return tickets.issueTicket(
        eventId,
        paidAllocId,
        { holderUserId },
        asUser(hostManagerId),
      );
    }

    it('holder checkout returns clientSecret and fee breakdown', async () => {
      const ticket = await issueUnpaidForHolder();
      expect(ticket.status).toBe('unpaid');

      const result = await payments.checkout(ticket.id, asUser(holderUserId));
      expect(result).toEqual({
        clientSecret: `cs_test_${suffix}`,
        priceCents: 1000,
        feeCents: 100,
        amountCents: 1100,
        currency: 'usd',
      });
      expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 1100,
          currency: 'usd',
          idempotencyKey: `ticket-checkout-${ticket.id}`,
          metadata: {
            ticketId: ticket.id,
            eventId,
            organizationId: hostOrgId,
          },
        }),
      );
      const createArgs = stripe.createPaymentIntent.mock.calls[0]?.[0] as {
        metadata?: unknown;
        transfer_data?: unknown;
      };
      expect(createArgs.transfer_data).toBeUndefined();

      const row = await prisma.ticketPayment.findUnique({
        where: { ticketId: ticket.id },
      });
      expect(row?.status).toBe('requires_payment');
      expect(row?.stripePaymentIntentId).toBe(`pi_new_${suffix}`);
    });

    it('reuses open PaymentIntent on second checkout', async () => {
      const ticket = await issueUnpaidForHolder();
      await payments.checkout(ticket.id, asUser(holderUserId));

      stripe.retrievePaymentIntent.mockResolvedValue({
        id: `pi_new_${suffix}`,
        client_secret: `cs_reused_${suffix}`,
        amount: 1100,
      });

      const again = await payments.checkout(ticket.id, asUser(holderUserId));
      expect(again.clientSecret).toBe(`cs_reused_${suffix}`);
      expect(stripe.createPaymentIntent).toHaveBeenCalledTimes(1);
      expect(stripe.retrievePaymentIntent).toHaveBeenCalledWith(
        `pi_new_${suffix}`,
      );
    });

    it('non-holder including ADMIN gets 403', async () => {
      const ticket = await issueUnpaidForHolder();
      await expect(
        payments.checkout(ticket.id, asUser(hostManagerId)),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        payments.checkout(ticket.id, asUser('admin-checkout', 'ADMIN')),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('rejects when host org charges disabled', async () => {
      const ticket = await issueUnpaidForHolder();
      await prisma.organization.update({
        where: { id: hostOrgId },
        data: { stripeChargesEnabled: false },
      });
      try {
        await expect(
          payments.checkout(ticket.id, asUser(holderUserId)),
        ).rejects.toBeInstanceOf(UnprocessableEntityException);
      } finally {
        await prisma.organization.update({
          where: { id: hostOrgId },
          data: { stripeChargesEnabled: true },
        });
      }
    });

    it('rejects when sale is closed', async () => {
      const ticket = await issueUnpaidForHolder();
      await tickets.patchTicketing(
        eventId,
        { ticketSaleStatus: 'closed' },
        asUser(hostManagerId),
      );
      try {
        await expect(
          payments.checkout(ticket.id, asUser(holderUserId)),
        ).rejects.toBeInstanceOf(BadRequestException);
      } finally {
        await tickets.patchTicketing(
          eventId,
          { ticketSaleStatus: 'on_sale' },
          asUser(hostManagerId),
        );
      }
    });

    it('rejects void tickets', async () => {
      const ticket = await issueUnpaidForHolder();
      await tickets.voidTicket(ticket.id, asUser(hostManagerId));
      await expect(
        payments.checkout(ticket.id, asUser(holderUserId)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects free allocation tickets', async () => {
      const free = await tickets.issueTicket(
        eventId,
        freeAllocId,
        { holderUserId },
        asUser(hostManagerId),
      );
      expect(free.status).toBe('paid');
      await expect(
        payments.checkout(free.id, asUser(holderUserId)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  },
);
