import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PublicUser } from '../types/auth.dto';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicUser => {
    const request = ctx.switchToHttp().getRequest<{ user: PublicUser }>();
    return request.user;
  },
);
