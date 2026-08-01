import { Controller, Get, Param, Patch, Query, Body } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsersLifecycleService } from './users-lifecycle.service';
import {
  AdminUserListSchema,
  AdminUserSchema,
  ListUsersQuerySchema,
  PatchUserStatusSchema,
  type AdminUser,
  type AdminUserList,
  type ListUsersQuery,
  type PatchUserStatus,
} from './types/admin-users.dto';

@Controller('admin/users')
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private readonly usersLifecycleService: UsersLifecycleService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(ListUsersQuerySchema)) query: ListUsersQuery,
  ): Promise<AdminUserList> {
    const users = await this.usersLifecycleService.list(query);
    return AdminUserListSchema.parse(users);
  }

  @Patch(':id/status')
  async patchStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PatchUserStatusSchema)) body: PatchUserStatus,
  ): Promise<AdminUser> {
    const user = await this.usersLifecycleService.patchStatus(id, body);
    return AdminUserSchema.parse(user);
  }
}
