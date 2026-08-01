import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { PublicUser } from '../auth/types/auth.dto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequireOrgPermission } from '../permissions/decorators/require-org-permission.decorator';
import { OrgPermissionGuard } from '../permissions/guards/org-permission.guard';
import { PendingUsersService } from './pending-users.service';
import {
  ListPendingApplicantsQuerySchema,
  OrgPendingUserParamsSchema,
  OrgPendingUsersParamsSchema,
  PatchPendingApplicantStatusSchema,
  PendingApplicantListSchema,
  PendingApplicantSchema,
  type ListPendingApplicantsQuery,
  type OrgPendingUserParams,
  type OrgPendingUsersParams,
  type PatchPendingApplicantStatus,
  type PendingApplicant,
  type PendingApplicantList,
} from './types/pending-users.dto';

@Controller('organizations/:organizationId/pending-users')
@UseGuards(OrgPermissionGuard)
@RequireOrgPermission('members.manage_permissions', {
  organizationIdParam: 'organizationId',
})
export class PendingUsersController {
  constructor(private readonly pendingUsersService: PendingUsersService) {}

  @Get()
  async list(
    @Param(new ZodValidationPipe(OrgPendingUsersParamsSchema))
    params: OrgPendingUsersParams,
    @Query(new ZodValidationPipe(ListPendingApplicantsQuerySchema))
    query: ListPendingApplicantsQuery,
  ): Promise<PendingApplicantList> {
    const users = await this.pendingUsersService.list(
      params.organizationId,
      query,
    );
    return PendingApplicantListSchema.parse(users);
  }

  @Patch(':userId')
  async patchStatus(
    @Param(new ZodValidationPipe(OrgPendingUserParamsSchema))
    params: OrgPendingUserParams,
    @Body(new ZodValidationPipe(PatchPendingApplicantStatusSchema))
    body: PatchPendingApplicantStatus,
    @CurrentUser() caller: PublicUser,
  ): Promise<PendingApplicant> {
    const user = await this.pendingUsersService.patchStatus(
      params.organizationId,
      params.userId,
      body,
      caller,
    );
    return PendingApplicantSchema.parse(user);
  }
}
