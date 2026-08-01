import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AdminUser,
  ListUsersQuery,
  PatchUserStatus,
} from './types/admin-users.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async list(query: ListUsersQuery): Promise<AdminUser[]> {
    const users = await this.prisma.user.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.authService.toPublicUser(u));
  }

  async patchStatus(userId: string, input: PatchUserStatus): Promise<AdminUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === 'PENDING' && input.status === 'ACTIVE') {
      const organizationId =
        input.organizationId ?? user.requestedOrganizationId ?? undefined;
      if (!organizationId) {
        throw new BadRequestException(
          'organizationId is required to approve a pending user; none on request and user has no requestedOrganizationId',
        );
      }
      return this.approveAndActivate(user.id, organizationId);
    }

    if (user.status === 'PENDING' && input.status === 'INACTIVE') {
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { status: 'INACTIVE' },
      });
      return this.authService.toPublicUser(updated);
    }

    if (user.status === 'ACTIVE' && input.status === 'INACTIVE') {
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { status: 'INACTIVE' },
      });
      return this.authService.toPublicUser(updated);
    }

    if (user.status === 'INACTIVE' && input.status === 'ACTIVE') {
      // Reactivate is status-only — not approve; do not assign membership here.
      if (input.organizationId) {
        throw new BadRequestException(
          'organizationId is not allowed when reactivating; assign membership separately',
        );
      }
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' },
      });
      return this.authService.toPublicUser(updated);
    }

    throw new BadRequestException(
      `Cannot transition user from ${user.status} to ${input.status}`,
    );
  }

  private async approveAndActivate(
    userId: string,
    organizationId: string,
  ): Promise<AdminUser> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new BadRequestException('Organization not found');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }
    if (targetUser.role === 'ADMIN') {
      throw new BadRequestException('ADMIN users cannot receive membership');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.membership.findUnique({ where: { userId } });
      if (existing) {
        await tx.membership.delete({ where: { id: existing.id } });
      }
      await tx.membership.create({
        data: { userId, organizationId },
      });
      return tx.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE' },
      });
    });

    return this.authService.toPublicUser(updated);
  }
}
