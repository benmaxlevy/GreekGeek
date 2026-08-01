import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [PermissionsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
