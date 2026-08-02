import { Module } from '@nestjs/common';
import { AdminQueueController } from './admin-queue.controller';
import { QueueModule } from './queue.module';

@Module({
  imports: [QueueModule],
  controllers: [AdminQueueController],
})
export class AdminQueueModule {}
