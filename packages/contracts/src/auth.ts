import { z } from 'zod';

export const RoleSchema = z.enum(['USER', 'ADMIN']);
export type Role = z.infer<typeof RoleSchema>;

export const UserStatusSchema = z.enum(['ACTIVE', 'PENDING', 'INACTIVE']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

/** Caller's org membership summary for session/me responses. */
export const PublicUserMembershipSchema = z.object({
  organizationId: z.string(),
  organizationName: z.string().optional(),
});
export type PublicUserMembership = z.infer<typeof PublicUserMembershipSchema>;

export const PublicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema,
  status: UserStatusSchema,
  requestedOrganizationId: z.string().nullable(),
  /** Null for ADMIN or users without a membership. */
  membership: PublicUserMembershipSchema.nullable(),
  /** Permission keys for the caller's membership; empty when none or ADMIN. */
  permissions: z.array(z.string()),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const SignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
  organizationId: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z.string().min(1).optional(),
  ),
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const SignupResponseSchema = z.object({
  user: PublicUserSchema,
});
export type SignupResponse = z.infer<typeof SignupResponseSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthTokensResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: PublicUserSchema,
});
export type AuthTokensResponse = z.infer<typeof AuthTokensResponseSchema>;

export const AccessTokenResponseSchema = z.object({
  accessToken: z.string().min(1),
});
export type AccessTokenResponse = z.infer<typeof AccessTokenResponseSchema>;

export const LogoutResponseSchema = z.object({
  ok: z.literal(true),
});
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
