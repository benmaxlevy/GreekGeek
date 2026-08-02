import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });

  // SIGTERM/SIGINT → Nest shutdown hooks → BullMQ Worker.close() drains active jobs
  app.enableShutdownHooks();

  logger.log('Worker started (BullMQ processors registered)');
}

void bootstrap();
