import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { EventPayoutsService } from './event-payouts.service';

export const EVENT_PAYOUT_SWEEP_JOB = 'sweep-event-payouts';
export const EVENT_PAYOUT_SCHEDULER_KEY = 'event-payout-sweep';

@Processor(QUEUE_NAMES.eventPayoutSweep)
export class EventPayoutSweepProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(EventPayoutSweepProcessor.name);

  constructor(
    private readonly payouts: EventPayoutsService,
    @InjectQueue(QUEUE_NAMES.eventPayoutSweep)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      EVENT_PAYOUT_SCHEDULER_KEY,
      { every: 60_000 },
      {
        name: EVENT_PAYOUT_SWEEP_JOB,
        data: {},
        opts: { removeOnComplete: true },
      },
    );
    this.logger.log('Registered event payout sweep every 60s');
  }

  async process(job: Job): Promise<void> {
    void job;
    const released = await this.payouts.sweepEligible();
    if (released > 0) {
      this.logger.log(`Event payout sweep released ${released} payout(s)`);
    }
  }
}
