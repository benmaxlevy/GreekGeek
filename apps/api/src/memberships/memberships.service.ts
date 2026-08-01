import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  toMembershipDto,
  type AssignMembership,
  type Membership,
} from './types/memberships.dto';

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Membership[]> {
    const rows = await this.prisma.membership.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toMembershipDto);
  }

  async get(id: string): Promise<Membership> {
    const row = await this.prisma.membership.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Membership not found');
    }
    return toMembershipDto(row);
  }

  /** Assign user to org. Atomically replaces existing membership if any. */
  async assign(input: AssignMembership): Promise<Membership> {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.role === 'ADMIN') {
      throw new BadRequestException('ADMIN users cannot receive membership');
    }
    if (user.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Membership can only be assigned to ACTIVE users',
      );
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
    });
    if (!org) {
      throw new BadRequestException('Organization not found');
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.membership.findUnique({
        where: { userId: input.userId },
      });
      if (existing) {
        await tx.membership.delete({ where: { id: existing.id } });
      }
      return tx.membership.create({
        data: {
          userId: input.userId,
          organizationId: input.organizationId,
        },
      });
    });

    return toMembershipDto(row);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.membership.delete({ where: { id } });
  }
}
