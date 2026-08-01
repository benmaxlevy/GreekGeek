import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  toMemberPermissionDto,
  toPermissionDto,
  type GrantPermission,
  type MemberPermission,
  type Permission,
} from './types/permissions.dto';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(): Promise<Permission[]> {
    const rows = await this.prisma.permission.findMany({
      orderBy: { key: 'asc' },
    });
    return rows.map(toPermissionDto);
  }

  async listForMembership(membershipId: string): Promise<MemberPermission[]> {
    await this.requireMembership(membershipId);
    const rows = await this.prisma.memberPermission.findMany({
      where: { membershipId },
      include: { permission: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toMemberPermissionDto);
  }

  async grant(
    membershipId: string,
    input: GrantPermission,
  ): Promise<MemberPermission> {
    const membership = await this.requireMembership(membershipId);
    if (membership.user.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Permissions can only be granted to ACTIVE members',
      );
    }

    const permission = await this.prisma.permission.findUnique({
      where: { key: input.permissionKey },
    });
    if (!permission) {
      throw new BadRequestException('Unknown permission key');
    }

    try {
      const row = await this.prisma.memberPermission.create({
        data: {
          membershipId,
          permissionId: permission.id,
        },
        include: { permission: true },
      });
      return toMemberPermissionDto(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Permission already granted');
      }
      throw error;
    }
  }

  async revoke(membershipId: string, permissionKey: string): Promise<void> {
    const membership = await this.requireMembership(membershipId);
    if (membership.user.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Permissions can only be revoked from ACTIVE members',
      );
    }

    const permission = await this.prisma.permission.findUnique({
      where: { key: permissionKey },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    const existing = await this.prisma.memberPermission.findUnique({
      where: {
        membershipId_permissionId: {
          membershipId,
          permissionId: permission.id,
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Member permission not found');
    }

    await this.prisma.memberPermission.delete({ where: { id: existing.id } });
  }

  private async requireMembership(membershipId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      include: { user: true },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    return membership;
  }
}
