import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../../config/env.schema';
import { AuthService } from '../auth.service';
import type { PublicUser } from '../types/auth.dto';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<PublicUser> {
    if (!payload?.sub || !payload?.email) {
      throw new UnauthorizedException('Invalid access token');
    }
    const user = await this.authService.getPublicUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid access token');
    }
    return user;
  }
}
