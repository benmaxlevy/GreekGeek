import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PublicUser } from '../../auth/types/auth.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ORG_PERMISSION_KEY,
  type OrgPermissionMeta,
} from '../decorators/require-org-permission.decorator';

@Injectable()
export class OrgPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<OrgPermissionMeta | undefined>(
      ORG_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: PublicUser;
      params: Record<string, string>;
      body: Record<string, unknown>;
    }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }
    if (user.role === 'ADMIN') {
      return true;
    }

    const organizationId = await this.resolveOrganizationId(request, meta);
    if (!organizationId) {
      throw new ForbiddenException('Organization context required');
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId: user.id },
      include: {
        permissions: { include: { permission: true } },
      },
    });

    if (!membership || membership.organizationId !== organizationId) {
      throw new ForbiddenException('Missing organization permission');
    }

    const hasPermission = membership.permissions.some(
      (mp) => mp.permission.key === meta.permissionKey,
    );
    if (!hasPermission) {
      throw new ForbiddenException('Missing organization permission');
    }
    return true;
  }

  private async resolveOrganizationId(
    request: {
      params: Record<string, string>;
      body: Record<string, unknown>;
    },
    meta: OrgPermissionMeta,
  ): Promise<string | null> {
    if (meta.membershipParam) {
      const membershipId = request.params[meta.membershipParam];
      if (!membershipId) {
        return null;
      }
      const membership = await this.prisma.membership.findUnique({
        where: { id: membershipId },
      });
      return membership?.organizationId ?? null;
    }

    const paramName = meta.organizationIdParam ?? 'organizationId';
    const fromParams = request.params[paramName];
    if (fromParams) {
      return fromParams;
    }
    const fromBody = request.body?.[paramName];
    return typeof fromBody === 'string' ? fromBody : null;
  }
}
