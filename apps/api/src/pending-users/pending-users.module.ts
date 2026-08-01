import { Module } from '@nestjs/common';
import { AdminUsersModule } from '../admin-users/admin-users.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { PendingUsersController } from './pending-users.controller';
import { PendingUsersService } from './pending-users.service';

@Module({
  imports: [AuthModule, AdminUsersModule, PermissionsModule],
  controllers: [PendingUsersController],
  providers: [PendingUsersService],
})
export class PendingUsersModule {}
