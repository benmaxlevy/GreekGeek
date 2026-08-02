import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { PurchasesService } from '../tickets/purchases.service';

export const PURCHASE_TTL_SWEEP_JOB = 'sweep-expired-purchases';

@Processor(QUEUE_NAMES.purchaseTtlSweep)
export class PurchaseTtlSweepProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(PurchaseTtlSweepProcessor.name);

  constructor(
    private readonly purchases: PurchasesService,
    @InjectQueue(QUEUE_NAMES.purchaseTtlSweep)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'purchase-ttl-sweep',
      { every: 60_000 },
      {
        name: PURCHASE_TTL_SWEEP_JOB,
        data: {},
        opts: { removeOnComplete: true },
      },
    );
    this.logger.log('Registered purchase TTL sweep every 60s');
  }

  async process(_job: Job): Promise<void> {
    const released = await this.purchases.sweepExpiredPurchases();
    if (released > 0) {
      this.logger.log(`Purchase TTL sweep released ${released} purchase(s)`);
    }
  }
}
