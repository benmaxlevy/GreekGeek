import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import {
  AccessTokenResponseSchema,
  AuthTokensResponseSchema,
  LoginRequestSchema,
  LogoutResponseSchema,
  PublicUserSchema,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_MS,
  SignupRequestSchema,
  type AccessTokenResponse,
  type AuthTokensResponse,
  type LoginRequest,
  type LogoutResponse,
  type PublicUser,
  type SignupRequest,
} from './types/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  async signup(
    @Body(new ZodValidationPipe(SignupRequestSchema)) body: SignupRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensResponse> {
    const session = await this.authService.signup(body);
    this.setRefreshCookie(res, session.refreshToken);
    return AuthTokensResponseSchema.parse(session.tokens);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) _body: LoginRequest,
    @CurrentUser() user: PublicUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensResponse> {
    const session = await this.authService.login(user);
    this.setRefreshCookie(res, session.refreshToken);
    return AuthTokensResponseSchema.parse(session.tokens);
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponse> {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const session = await this.authService.refresh(raw);
    this.setRefreshCookie(res, session.refreshToken);
    return AccessTokenResponseSchema.parse({
      accessToken: session.tokens.accessToken,
    });
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponse> {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await this.authService.logout(raw);
    res.clearCookie(REFRESH_COOKIE_NAME, {
      path: REFRESH_COOKIE_PATH,
      httpOnly: true,
      sameSite: 'lax',
    });
    return LogoutResponseSchema.parse({ ok: true });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: PublicUser): PublicUser {
    return PublicUserSchema.parse(user);
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }
}
