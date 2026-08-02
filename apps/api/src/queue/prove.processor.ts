import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.constants';
import type { EnqueueProveJob } from './types/prove-job.dto';

@Processor(QUEUE_NAMES.prove)
export class ProveProcessor extends WorkerHost {
  private readonly logger = new Logger(ProveProcessor.name);

  async process(job: Job<EnqueueProveJob>): Promise<void> {
    try {
      this.logger.log(`Prove job processed id=${job.id}`);
    } catch (error) {
      const payloadKeys = Object.keys(job.data ?? {});
      this.logger.error(
        `Prove job failed id=${job.id} keys=${payloadKeys.join(',')}`,
      );
      throw error;
    }
  }
}
