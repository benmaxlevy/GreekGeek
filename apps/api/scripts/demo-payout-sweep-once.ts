/**
 * Run one event-payout sweep (same logic as BullMQ worker).
 * Usage: pnpm exec tsx scripts/demo-payout-sweep-once.ts
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppConfigModule } from '../src/config/config.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { StripeModule } from '../src/stripe/stripe.module';
import { EventPayoutsModule } from '../src/payouts/event-payouts.module';
import { EventPayoutsService } from '../src/payouts/event-payouts.service';

@Module({
  imports: [AppConfigModule, PrismaModule, StripeModule, EventPayoutsModule],
})
class DemoPayoutSweepModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(DemoPayoutSweepModule, {
    logger: ['error', 'warn'],
  });
  try {
    const payouts = app.get(EventPayoutsService);
    const released = await payouts.sweepEligible();
    console.log(JSON.stringify({ released }));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
