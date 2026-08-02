import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_MS,
  type AuthTokensResponse,
  type ProfileSummary,
  type PublicUser,
  type SignupRequest,
  type SignupResponse,
} from './types/auth.dto';

type UserWithMembership = {
  id: string;
  email: string;
  name: string;
  role: PublicUser['role'];
  status: PublicUser['status'];
  requestedOrganizationId: string | null;
  membership?: {
    organizationId: string;
    organization?: { name: string } | null;
    permissions?: Array<{ permission: { key: string } }>;
  } | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  toPublicUser(user: UserWithMembership): PublicUser {
    if (user.role === 'ADMIN') {
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        requestedOrganizationId: user.requestedOrganizationId,
        membership: null,
        permissions: [],
      };
    }

    const membership = user.membership
      ? {
          organizationId: user.membership.organizationId,
          ...(user.membership.organization?.name
            ? { organizationName: user.membership.organization.name }
            : {}),
        }
      : null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      requestedOrganizationId: user.requestedOrganizationId,
      membership,
      permissions: user.membership?.permissions?.map((mp) => mp.permission.key) ?? [],
    };
  }

  async getPublicUserById(id: string): Promise<PublicUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        membership: {
          include: {
            organization: true,
            permissions: { include: { permission: true } },
          },
        },
      },
    });
    return user ? this.toPublicUser(user) : null;
  }

  async updateDisplayName(caller: PublicUser, name: string): Promise<PublicUser> {
    if (caller.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is not active');
    }

    const updated = await this.prisma.user.updateMany({
      where: { id: caller.id, status: 'ACTIVE' },
      data: { name },
    });
    if (updated.count === 0) {
      throw new ForbiddenException('Account is not active');
    }

    const publicUser = await this.getPublicUserById(caller.id);
    if (!publicUser) {
      throw new UnauthorizedException('User no longer exists');
    }
    return publicUser;
  }

  async getProfileSummary(caller: PublicUser): Promise<ProfileSummary> {
    if (caller.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is not active');
    }

    const now = new Date();
    const ownedNonVoidTicket = {
      holderUserId: caller.id,
      status: { not: 'void' as const },
    };
    const futureOwnedEvent = {
      startsAt: { gt: now },
      allocations: {
        some: {
          tickets: {
            some: ownedNonVoidTicket,
          },
        },
      },
    };

    const [ticketCount, upcomingEventCount, nextEvent] = await Promise.all([
      this.prisma.ticket.count({ where: ownedNonVoidTicket }),
      this.prisma.event.count({ where: futureOwnedEvent }),
      this.prisma.event.findFirst({
        where: futureOwnedEvent,
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          startsAt: true,
          location: true,
          allocations: {
            select: {
              tickets: {
                where: ownedNonVoidTicket,
                select: { id: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      ticketCount,
      upcomingEventCount,
      nextEvent: nextEvent
        ? {
            eventId: nextEvent.id,
            eventName: nextEvent.name,
            startsAt: nextEvent.startsAt.toISOString(),
            location: nextEvent.location,
            ticketCount: nextEvent.allocations.reduce(
              (count, allocation) => count + allocation.tickets.length,
              0,
            ),
          }
        : null,
    };
  }

  async validateUser(email: string, password: string): Promise<PublicUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        membership: {
          include: {
            organization: true,
            permissions: { include: { permission: true } },
          },
        },
      },
    });
    if (!user) {
      return null;
    }
    const valid = await this.passwordService.verify(user.passwordHash, password);
    if (!valid) {
      return null;
    }
    return this.toPublicUser(user);
  }

  /** Creates user without session tokens; ACTIVE when no org, PENDING when org requested. */
  async signup(input: SignupRequest): Promise<SignupResponse> {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const organizationId = input.organizationId || undefined;
    const passwordHash = await this.passwordService.hash(input.password);

    if (organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) {
        throw new BadRequestException('Organization not found');
      }

      const user = await this.prisma.user.create({
        data: {
          email,
          name: input.name,
          passwordHash,
          role: 'USER',
          status: 'PENDING',
          requestedOrganizationId: org.id,
        },
      });

      return { user: this.toPublicUser(user) };
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name,
        passwordHash,
        role: 'USER',
        status: 'ACTIVE',
        requestedOrganizationId: null,
      },
    });

    return { user: this.toPublicUser(user) };
  }

  async login(user: PublicUser): Promise<{
    tokens: AuthTokensResponse;
    refreshToken: string;
  }> {
    return this.issueSession(user);
  }

  async refresh(rawRefreshToken: string | undefined): Promise<{
    tokens: AuthTokensResponse;
    refreshToken: string;
  }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing || existing.revokedAt || existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const publicUser = await this.getPublicUserById(existing.user.id);
    if (!publicUser) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueSession(publicUser);
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueSession(user: PublicUser): Promise<{
    tokens: AuthTokensResponse;
    refreshToken: string;
  }> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { expiresIn: ACCESS_TOKEN_TTL },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hashRefreshToken(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      tokens: { accessToken, user },
      refreshToken,
    };
  }

  hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
