import { z } from 'zod';
import { PublicUserSchema, UserStatusSchema } from './auth';

export const ListUsersQuerySchema = z.object({
  status: UserStatusSchema.optional(),
});
export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;

export const AdminUserSchema = PublicUserSchema;
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const AdminUserListSchema = z.array(AdminUserSchema);
export type AdminUserList = z.infer<typeof AdminUserListSchema>;

/**
 * Patch user status.
 * Approve (PENDING→ACTIVE): organizationId optional; defaults to user.requestedOrganizationId.
 * Body organizationId overrides. Neither → 400.
 * Deny (PENDING→INACTIVE): status only.
 */
export const PatchUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
  organizationId: z.string().min(1).optional(),
});
export type PatchUserStatus = z.infer<typeof PatchUserStatusSchema>;
