import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import Stripe from 'stripe';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { PublicUser } from '../auth/types/auth.dto';
import type { Env } from '../config/env.schema';
import { WebhookEventsService } from './webhook-events.service';
import type { WebhookProcessJob } from './types/webhook-process-job.dto';

const TEST_SECRET = 'whsec_test_local_dev_secret';

function makeConfig(
  secret = TEST_SECRET,
): ConfigService<Env, true> {
  return {
    get: (key: string) => {
      if (key === 'STRIPE_WEBHOOK_SECRET') {
        return secret;
      }
      return undefined;
    },
  } as unknown as ConfigService<Env, true>;
}

function stripeEventPayload(id: string, type = 'checkout.session.completed') {
  return JSON.stringify({
    id,
    object: 'event',
    type,
    data: { object: { id: 'cs_test_1' } },
  });
}

function signedHeader(payload: string, secret = TEST_SECRET): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret });
}

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)('Webhook inbox ingest + admin', () => {
  const prisma = new PrismaClient();
  let queueAdd: jest.Mock;
  let queue: Queue<WebhookProcessJob>;
  let service: WebhookEventsService;
  const suffix = Date.now();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany({
      where: { externalId: { startsWith: `evt_test_${suffix}` } },
    });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    queueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
    queue = { add: queueAdd } as unknown as Queue<WebhookProcessJob>;
    service = new WebhookEventsService(
      prisma as never,
      makeConfig(),
      queue,
    );
  });

  it('rejects invalid signature with 400 and stores no row', async () => {
    const externalId = `evt_test_${suffix}_bad_sig`;
    const payload = stripeEventPayload(externalId);

    await expect(
      service.ingestStripeWebhook(Buffer.from(payload), 't=1,v1=bad'),
    ).rejects.toBeInstanceOf(BadRequestException);

    const row = await prisma.webhookEvent.findUnique({
      where: {
        service_externalId: { service: 'stripe', externalId },
      },
    });
    expect(row).toBeNull();
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it('ingests valid event: row + enqueue', async () => {
    const externalId = `evt_test_${suffix}_ok`;
    const payload = stripeEventPayload(externalId);
    const header = signedHeader(payload);

    const result = await service.ingestStripeWebhook(
      Buffer.from(payload),
      header,
    );

    expect(result.duplicate).toBe(false);
    expect(result.webhookEventId).toBeTruthy();

    const row = await prisma.webhookEvent.findUnique({
      where: {
        service_externalId: { service: 'stripe', externalId },
      },
    });
    expect(row).not.toBeNull();
    expect(row?.type).toBe('checkout.session.completed');
    expect(row?.processedAt).toBeNull();
    expect(queueAdd).toHaveBeenCalledTimes(1);
    expect(queueAdd.mock.calls[0]?.[1]).toEqual({
      webhookEventId: row?.id,
    });
  });

  it('duplicate ingest returns 200 path with no second row or enqueue', async () => {
    const externalId = `evt_test_${suffix}_dup`;
    const payload = stripeEventPayload(externalId);
    const header = signedHeader(payload);

    await service.ingestStripeWebhook(Buffer.from(payload), header);
    queueAdd.mockClear();

    const result = await service.ingestStripeWebhook(
      Buffer.from(payload),
      header,
    );

    expect(result.duplicate).toBe(true);
    expect(queueAdd).not.toHaveBeenCalled();

    const count = await prisma.webhookEvent.count({
      where: { service: 'stripe', externalId },
    });
    expect(count).toBe(1);
  });

  it('admin list failed filter returns processedAt null + lastError set', async () => {
    const failed = await prisma.webhookEvent.create({
      data: {
        service: 'stripe',
        externalId: `evt_test_${suffix}_failed`,
        type: 'invoice.paid',
        payload: { id: `evt_test_${suffix}_failed` },
        attempts: 2,
        lastError: 'boom',
      },
    });
    await prisma.webhookEvent.create({
      data: {
        service: 'stripe',
        externalId: `evt_test_${suffix}_unprocessed_clean`,
        type: 'invoice.paid',
        payload: {},
      },
    });
    await prisma.webhookEvent.create({
      data: {
        service: 'stripe',
        externalId: `evt_test_${suffix}_processed`,
        type: 'invoice.paid',
        payload: {},
        processedAt: new Date(),
        lastError: null,
      },
    });

    const listed = await service.list({ status: 'failed' });
    const ids = listed.map((e) => e.id);
    expect(ids).toContain(failed.id);
    expect(
      listed.every((e) => e.processedAt === null && e.lastError !== null),
    ).toBe(true);
  });

  it('requeue rejects already-processed events', async () => {
    const row = await prisma.webhookEvent.create({
      data: {
        service: 'stripe',
        externalId: `evt_test_${suffix}_requeue_done`,
        type: 'invoice.paid',
        payload: {},
        processedAt: new Date(),
      },
    });

    await expect(service.requeue(row.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(queueAdd).not.toHaveBeenCalled();
  });
});

describe('Admin webhook-events roles', () => {
  const rolesGuard = new RolesGuard({
    getAllAndOverride: (key: string) => {
      if (key === ROLES_KEY) {
        return ['ADMIN'];
      }
      return undefined;
    },
  } as unknown as Reflector);

  function mockContext(user?: PublicUser): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  const adminUser: PublicUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    requestedOrganizationId: null,
    membership: null,
    permissions: [],
  };

  const memberUser: PublicUser = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    role: 'USER',
    status: 'ACTIVE',
    requestedOrganizationId: null,
    membership: null,
    permissions: [],
  };

  it('allows ADMIN', () => {
    expect(rolesGuard.canActivate(mockContext(adminUser))).toBe(true);
  });

  it('rejects non-ADMIN with 403', () => {
    expect(() => rolesGuard.canActivate(mockContext(memberUser))).toThrow(
      ForbiddenException,
    );
  });
});
