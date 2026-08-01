import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { AdminUsersController } from './admin-users.controller';
import { PendingUsersController } from './pending-users.controller';
import { PendingUsersService } from './pending-users.service';
import { UsersLifecycleService } from './users-lifecycle.service';

@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [AdminUsersController, PendingUsersController],
  providers: [UsersLifecycleService, PendingUsersService],
  exports: [UsersLifecycleService],
})
export class UsersModule {}
