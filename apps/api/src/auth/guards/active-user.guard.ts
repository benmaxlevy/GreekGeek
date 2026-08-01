import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_NON_ACTIVE_KEY } from '../decorators/allow-non-active.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { PublicUser } from '../types/auth.dto';

/**
 * Blocks non-ACTIVE authenticated users from protected resources.
 * Skip for @Public() and @AllowNonActive() handlers.
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const allowNonActive = this.reflector.getAllAndOverride<boolean>(
      ALLOW_NON_ACTIVE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowNonActive) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: PublicUser }>();
    const user = request.user;
    if (!user) {
      return true;
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is not active');
    }
    return true;
  }
}
