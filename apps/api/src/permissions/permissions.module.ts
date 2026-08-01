import { Module } from '@nestjs/common';
import { OrgPermissionGuard } from './guards/org-permission.guard';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService, OrgPermissionGuard],
  exports: [PermissionsService, OrgPermissionGuard],
})
export class PermissionsModule {}
