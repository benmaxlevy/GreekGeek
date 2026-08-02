import type { Job } from 'bullmq';
import { ProveProcessor } from './prove.processor';
import type { EnqueueProveJob } from './types/prove-job.dto';

describe('ProveProcessor', () => {
  it('logs job id on success', async () => {
    const processor = new ProveProcessor();
    const log = jest
      .spyOn(
        (processor as unknown as { logger: { log: (m: string) => void } })
          .logger,
        'log',
      )
      .mockImplementation(() => undefined);

    await processor.process({
      id: 'job-42',
      data: { message: 'hello' },
    } as Job<EnqueueProveJob>);

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Prove job processed id=job-42'),
    );
  });

  it('on failure logs job id and payload keys only (no PII values)', async () => {
    const processor = new ProveProcessor();
    jest
      .spyOn(
        (processor as unknown as { logger: { log: (m: string) => void } })
          .logger,
        'log',
      )
      .mockImplementation(() => {
        throw new Error('forced failure');
      });
    const error = jest
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
        id: 'job-99',
        data: { message: 'secret-pii-value' },
      } as Job<EnqueueProveJob>),
    ).rejects.toThrow('forced failure');

    expect(error).toHaveBeenCalledTimes(1);
    const line = String(error.mock.calls[0]?.[0] ?? '');
    expect(line).toContain('id=job-99');
    expect(line).toContain('keys=message');
    expect(line).not.toContain('secret-pii-value');
  });
});
