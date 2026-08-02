import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { ProveProcessor } from './queue/prove.processor';
import { QueueModule } from './queue/queue.module';

/**
 * Worker process root — queue processors only (no HTTP controllers).
 */
@Module({
  imports: [AppConfigModule, QueueModule],
  providers: [ProveProcessor],
})
export class WorkerModule {}
