import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequireOrgPermission } from './decorators/require-org-permission.decorator';
import { OrgPermissionGuard } from './guards/org-permission.guard';
import { PermissionsService } from './permissions.service';
import {
  GrantPermissionSchema,
  MemberPermissionListSchema,
  MemberPermissionSchema,
  PermissionListSchema,
  type GrantPermission,
  type MemberPermission,
  type MemberPermissionList,
  type PermissionList,
} from './types/permissions.dto';

@Controller()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('permissions')
  @Roles('ADMIN')
  async listCatalog(): Promise<PermissionList> {
    return PermissionListSchema.parse(
      await this.permissionsService.listCatalog(),
    );
  }

  @Get('memberships/:membershipId/permissions')
  @Roles('ADMIN')
  async listForMembership(
    @Param('membershipId') membershipId: string,
  ): Promise<MemberPermissionList> {
    return MemberPermissionListSchema.parse(
      await this.permissionsService.listForMembership(membershipId),
    );
  }

  @Post('memberships/:membershipId/permissions')
  @UseGuards(OrgPermissionGuard)
  @RequireOrgPermission('members.manage_permissions', {
    membershipParam: 'membershipId',
  })
  async grant(
    @Param('membershipId') membershipId: string,
    @Body(new ZodValidationPipe(GrantPermissionSchema)) body: GrantPermission,
  ): Promise<MemberPermission> {
    return MemberPermissionSchema.parse(
      await this.permissionsService.grant(membershipId, body),
    );
  }

  @Delete('memberships/:membershipId/permissions/:permissionKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OrgPermissionGuard)
  @RequireOrgPermission('members.manage_permissions', {
    membershipParam: 'membershipId',
  })
  async revoke(
    @Param('membershipId') membershipId: string,
    @Param('permissionKey') permissionKey: string,
  ): Promise<void> {
    await this.permissionsService.revoke(membershipId, permissionKey);
  }
}
