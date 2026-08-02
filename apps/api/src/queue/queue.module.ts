import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { DEFAULT_JOB_OPTIONS } from './queue-defaults';
import { QUEUE_NAMES } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: {
          url: config.get('REDIS_URL', { infer: true }),
        },
      }),
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.prove,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
