import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  toOrganizationDto,
  type CreateOrganization,
  type ListOrganizationsQuery,
  type Organization,
  type UpdateOrganization,
} from './types/organizations.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListOrganizationsQuery): Promise<Organization[]> {
    const rows = await this.prisma.organization.findMany({
      where: query.universityId
        ? { universityId: query.universityId }
        : undefined,
      orderBy: { name: 'asc' },
    });
    return rows.map(toOrganizationDto);
  }

  async get(id: string): Promise<Organization> {
    const row = await this.prisma.organization.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Organization not found');
    }
    return toOrganizationDto(row);
  }

  async create(input: CreateOrganization): Promise<Organization> {
    const university = await this.prisma.university.findUnique({
      where: { id: input.universityId },
    });
    if (!university) {
      throw new BadRequestException('University not found');
    }
    try {
      const row = await this.prisma.organization.create({
        data: {
          name: input.name,
          type: input.type,
          universityId: input.universityId,
        },
      });
      return toOrganizationDto(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Organization name already exists at this university',
        );
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateOrganization): Promise<Organization> {
    await this.get(id);
    try {
      const row = await this.prisma.organization.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
        },
      });
      return toOrganizationDto(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Organization name already exists at this university',
        );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    const membershipCount = await this.prisma.membership.count({
      where: { organizationId: id },
    });
    if (membershipCount > 0) {
      throw new ConflictException(
        'Cannot delete organization with existing memberships',
      );
    }
    await this.prisma.organization.delete({ where: { id } });
  }
}
