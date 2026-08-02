import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Post, Body } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { QUEUE_NAMES } from './queue.constants';
import {
  EnqueueProveJobSchema,
  EnqueueProveJobResponseSchema,
  type EnqueueProveJob,
  type EnqueueProveJobResponse,
} from './types/prove-job.dto';

@Controller('admin/queue')
@Roles('ADMIN')
export class AdminQueueController {
  constructor(
    @InjectQueue(QUEUE_NAMES.prove) private readonly proveQueue: Queue,
  ) {}

  @Post('prove')
  async enqueueProve(
    @Body(new ZodValidationPipe(EnqueueProveJobSchema)) body: EnqueueProveJob,
  ): Promise<EnqueueProveJobResponse> {
    const job = await this.proveQueue.add(QUEUE_NAMES.prove, body);
    return EnqueueProveJobResponseSchema.parse({ jobId: String(job.id) });
  }
}
