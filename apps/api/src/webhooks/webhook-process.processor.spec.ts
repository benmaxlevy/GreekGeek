import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookHandlerRegistry } from './webhook-handler.registry';
import { WebhookProcessProcessor } from './webhook-process.processor';
import type { WebhookProcessJob } from './types/webhook-process-job.dto';

describe('WebhookProcessProcessor', () => {
  function makePrisma(overrides: {
    findUnique?: jest.Mock;
    update?: jest.Mock;
  }) {
    return {
      webhookEvent: {
        findUnique:
          overrides.findUnique ??
          jest.fn().mockResolvedValue({
            id: 'wh_1',
            service: 'stripe',
            type: 'some.unknown.type',
            payload: {},
            processedAt: null,
          }),
        update: overrides.update ?? jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;
  }

  function makeRegistry(handler?: jest.Mock) {
    const registry = new WebhookHandlerRegistry();
    if (handler) {
      registry.register('account.updated', handler);
    }
    return registry;
  }

  it('marks unknown type processed', async () => {
    const update = jest.fn().mockResolvedValue({});
    const processor = new WebhookProcessProcessor(
      makePrisma({ update }),
      makeRegistry(),
    );

    await processor.process({
      id: 'job-1',
      data: { webhookEventId: 'wh_1' },
    } as Job<WebhookProcessJob>);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'wh_1' },
      data: {
        processedAt: expect.any(Date),
        lastError: null,
      },
    });
  });

  it('invokes registered handler then marks processed', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const update = jest.fn().mockResolvedValue({});
    const processor = new WebhookProcessProcessor(
      makePrisma({
        findUnique: jest.fn().mockResolvedValue({
          id: 'wh_1',
          service: 'stripe',
          type: 'account.updated',
          payload: { id: 'evt_1', type: 'account.updated' },
          processedAt: null,
        }),
        update,
      }),
      makeRegistry(handler),
    );

    await processor.process({
      id: 'job-handler',
      data: { webhookEventId: 'wh_1' },
    } as Job<WebhookProcessJob>);

    expect(handler).toHaveBeenCalledWith({
      type: 'account.updated',
      payload: { id: 'evt_1', type: 'account.updated' },
      webhookEventId: 'wh_1',
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'wh_1' },
      data: {
        processedAt: expect.any(Date),
        lastError: null,
      },
    });
  });

  it('already processed is no-op', async () => {
    const update = jest.fn();
    const handler = jest.fn();
    const processor = new WebhookProcessProcessor(
      makePrisma({
        findUnique: jest.fn().mockResolvedValue({
          id: 'wh_1',
          service: 'stripe',
          type: 'account.updated',
          payload: {},
          processedAt: new Date(),
        }),
        update,
      }),
      makeRegistry(handler),
    );

    await processor.process({
      id: 'job-2',
      data: { webhookEventId: 'wh_1' },
    } as Job<WebhookProcessJob>);

    expect(handler).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('on failure increments attempts, sets lastError, rethrows; logs keys only', async () => {
    const update = jest
      .fn()
      .mockRejectedValueOnce(new Error('handler boom'))
      .mockResolvedValueOnce({});
    const processor = new WebhookProcessProcessor(
      makePrisma({ update }),
      makeRegistry(),
    );
    const errorLog = jest
      .spyOn(
        (
          processor as unknown as {
            logger: { error: (m: string) => void };
          }
        ).logger,
        'error',
      )
      .mockImplementation(() => undefined);

    await expect(
      processor.process({
        id: 'job-fail',
        data: { webhookEventId: 'wh_1' },
      } as Job<WebhookProcessJob>),
    ).rejects.toThrow('handler boom');

    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 'wh_1' },
      data: {
        attempts: { increment: 1 },
        lastError: 'handler boom',
      },
    });

    const line = String(errorLog.mock.calls[0]?.[0] ?? '');
    expect(line).toContain('id=job-fail');
    expect(line).toContain('keys=webhookEventId');
    expect(line).not.toContain('handler boom');
  });
});
