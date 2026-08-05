import {
  AccessTokenResponseSchema,
  AuthTokensResponseSchema,
  LoginRequestSchema,
  LogoutResponseSchema,
  ProfileSummaryNextEventSchema,
  ProfileSummarySchema,
  PublicUserMembershipSchema,
  PublicUserSchema,
  SignupRequestSchema,
  SignupResponseSchema,
  UpdateDisplayNameRequestSchema,
  type AccessTokenResponse,
  type AuthTokensResponse,
  type LoginRequest,
  type LogoutResponse,
  type ProfileSummary,
  type ProfileSummaryNextEvent,
  type PublicUser,
  type PublicUserMembership,
  type SignupRequest,
  type SignupResponse,
  type UpdateDisplayNameRequest,
} from '@greekgeek/contracts';

export {
  AccessTokenResponseSchema,
  AuthTokensResponseSchema,
  LoginRequestSchema,
  LogoutResponseSchema,
  ProfileSummaryNextEventSchema,
  ProfileSummarySchema,
  PublicUserMembershipSchema,
  PublicUserSchema,
  SignupRequestSchema,
  SignupResponseSchema,
  UpdateDisplayNameRequestSchema,
};

export type {
  AccessTokenResponse,
  AuthTokensResponse,
  LoginRequest,
  LogoutResponse,
  ProfileSummary,
  ProfileSummaryNextEvent,
  PublicUser,
  PublicUserMembership,
  SignupRequest,
  SignupResponse,
  UpdateDisplayNameRequest,
};

export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/auth';
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
