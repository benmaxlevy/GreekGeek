import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
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
            processedAt: null,
          }),
        update: overrides.update ?? jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;
  }

  it('marks unknown type processed', async () => {
    const update = jest.fn().mockResolvedValue({});
    const processor = new WebhookProcessProcessor(
      makePrisma({ update }),
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

  it('already processed is no-op', async () => {
    const update = jest.fn();
    const processor = new WebhookProcessProcessor(
      makePrisma({
        findUnique: jest.fn().mockResolvedValue({
          id: 'wh_1',
          service: 'stripe',
          type: 'invoice.paid',
          processedAt: new Date(),
        }),
        update,
      }),
    );

    await processor.process({
      id: 'job-2',
      data: { webhookEventId: 'wh_1' },
    } as Job<WebhookProcessJob>);

    expect(update).not.toHaveBeenCalled();
  });

  it('on failure increments attempts, sets lastError, rethrows; logs keys only', async () => {
    const update = jest
      .fn()
      .mockRejectedValueOnce(new Error('handler boom'))
      .mockResolvedValueOnce({});
    const processor = new WebhookProcessProcessor(
      makePrisma({ update }),
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
