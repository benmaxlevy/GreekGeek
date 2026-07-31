import { z } from 'zod';

export const RoleSchema = z.enum(['USER', 'ADMIN']);
export type Role = z.infer<typeof RoleSchema>;

export const PublicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema,
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const SignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

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
