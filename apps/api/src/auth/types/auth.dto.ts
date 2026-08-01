import {
  AccessTokenResponseSchema,
  AuthTokensResponseSchema,
  LoginRequestSchema,
  LogoutResponseSchema,
  PublicUserMembershipSchema,
  PublicUserSchema,
  SignupRequestSchema,
  SignupResponseSchema,
  type AccessTokenResponse,
  type AuthTokensResponse,
  type LoginRequest,
  type LogoutResponse,
  type PublicUser,
  type PublicUserMembership,
  type SignupRequest,
  type SignupResponse,
} from '@rally/contracts';

export {
  AccessTokenResponseSchema,
  AuthTokensResponseSchema,
  LoginRequestSchema,
  LogoutResponseSchema,
  PublicUserMembershipSchema,
  PublicUserSchema,
  SignupRequestSchema,
  SignupResponseSchema,
};

export type {
  AccessTokenResponse,
  AuthTokensResponse,
  LoginRequest,
  LogoutResponse,
  PublicUser,
  PublicUserMembership,
  SignupRequest,
  SignupResponse,
};

export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/auth';
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
