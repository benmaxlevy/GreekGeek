import type { Queue } from 'bullmq';
import {
  EventPayoutSweepProcessor,
  EVENT_PAYOUT_SCHEDULER_KEY,
} from './event-payout-sweep.processor';
import type { EventPayoutsService } from './event-payouts.service';

describe('EventPayoutSweepProcessor', () => {
  it('registers one fixed scheduler key and invokes sweep', async () => {
    const upsertJobScheduler = jest.fn().mockResolvedValue(undefined);
    const payouts = {
      sweepEligible: jest.fn().mockResolvedValue(1),
    } as unknown as EventPayoutsService;
    const processor = new EventPayoutSweepProcessor(payouts, {
      upsertJobScheduler,
    } as unknown as Queue);

    await processor.onModuleInit();
    await processor.process({} as never);

    expect(upsertJobScheduler).toHaveBeenCalledWith(
      EVENT_PAYOUT_SCHEDULER_KEY,
      { every: 60_000 },
      expect.objectContaining({ name: 'sweep-event-payouts' }),
    );
    expect(payouts.sweepEligible).toHaveBeenCalledTimes(1);
  });
});
