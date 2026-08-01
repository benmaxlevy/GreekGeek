import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import type { PublicUser } from '../auth/types/auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersLifecycleService } from './users-lifecycle.service';
import type {
  ListPendingApplicantsQuery,
  PatchPendingApplicantStatus,
  PendingApplicant,
} from './types/pending-users.dto';

@Injectable()
export class PendingUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly usersLifecycleService: UsersLifecycleService,
  ) {}

  async list(
    organizationId: string,
    _query: ListPendingApplicantsQuery,
  ): Promise<PendingApplicant[]> {
    const users = await this.prisma.user.findMany({
      where: {
        status: 'PENDING',
        requestedOrganizationId: organizationId,
      },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.authService.toPublicUser(u));
  }

  async patchStatus(
    organizationId: string,
    userId: string,
    input: PatchPendingApplicantStatus,
    caller: PublicUser,
  ): Promise<PendingApplicant> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot transition user from ${user.status} to ${input.status} via pending-users`,
      );
    }

    if (user.requestedOrganizationId !== organizationId) {
      throw new ForbiddenException(
        'Applicant requestedOrganizationId does not match organization',
      );
    }

    if (input.status === 'INACTIVE') {
      if (input.organizationId) {
        throw new BadRequestException(
          'organizationId is not allowed when denying a pending user',
        );
      }
      return this.usersLifecycleService.denyPending(user.id);
    }

    // Approve PENDING → ACTIVE
    if (caller.role !== 'ADMIN' && input.organizationId !== undefined) {
      throw new BadRequestException(
        'organizationId override is not allowed for non-ADMIN callers',
      );
    }

    const membershipOrganizationId =
      caller.role === 'ADMIN' && input.organizationId
        ? input.organizationId
        : user.requestedOrganizationId;

    if (!membershipOrganizationId) {
      throw new BadRequestException(
        'organizationId is required to approve a pending user; none on request and user has no requestedOrganizationId',
      );
    }

    return this.usersLifecycleService.approveAndActivate(
      user.id,
      membershipOrganizationId,
    );
  }
}
