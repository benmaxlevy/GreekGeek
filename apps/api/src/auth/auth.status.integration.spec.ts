import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { OrganizationsService } from '../organizations/organizations.service';
import { UniversitiesService } from '../universities/universities.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { ActiveUserGuard } from './guards/active-user.guard';
import type { PublicUser } from './types/auth.dto';

const hasDatabase = Boolean(process.env.DATABASE_URL);

function mockContext(user?: PublicUser): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        params: {},
        body: {},
      }),
    }),
  } as unknown as ExecutionContext;
}

(hasDatabase ? describe : describe.skip)('Auth status integration', () => {
  const prisma = new PrismaClient();
  const passwords = new PasswordService();
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET ?? 'test-jwt-secret-min-16-chars',
  });
  const auth = new AuthService(prisma as never, passwords, jwt);
  const universities = new UniversitiesService(prisma as never);
  const organizations = new OrganizationsService(prisma as never);
  const activeGuard = new ActiveUserGuard({
    getAllAndOverride: () => false,
  } as unknown as Reflector);

  const suffix = `auth-status-${Date.now()}`;
  let universityId = '';
  let orgId = '';
  let pendingUserId = '';

  beforeAll(async () => {
    const uni = await universities.create({
      name: `Auth Status Uni ${suffix}`,
    });
    universityId = uni.id;

    const org = await organizations.create({
      name: `Auth Status Org ${suffix}`,
      type: 'FRATERNITY',
      universityId,
    });
    orgId = org.id;

    const pending = await prisma.user.create({
      data: {
        email: `pending-${suffix}@example.com`,
        name: 'Pending User',
        passwordHash: await passwords.hash('PendingPass123!'),
        role: 'USER',
        status: 'PENDING',
      },
    });
    pendingUserId = pending.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: { userId: pendingUserId },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: pendingUserId },
          { email: { contains: suffix } },
        ],
      },
    });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.university.deleteMany({ where: { id: universityId } });
    await prisma.$disconnect();
  });

  it('PENDING login and refresh succeed; active guard blocks protected use', async () => {
    const pending = await prisma.user.findUniqueOrThrow({
      where: { id: pendingUserId },
    });
    const publicUser = auth.toPublicUser(pending);
    expect(publicUser.status).toBe('PENDING');
    const session = await auth.login(publicUser);
    expect(session.tokens.accessToken).toBeTruthy();
    expect(session.tokens.user.status).toBe('PENDING');

    const refreshed = await auth.refresh(session.refreshToken);
    expect(refreshed.tokens.accessToken).toBeTruthy();

    expect(() => activeGuard.canActivate(mockContext(publicUser))).toThrow(
      ForbiddenException,
    );
  });

  it('INACTIVE login succeeds; active guard blocks', async () => {
    await prisma.user.update({
      where: { id: pendingUserId },
      data: { status: 'INACTIVE' },
    });
    try {
      const inactive = auth.toPublicUser(
        await prisma.user.findUniqueOrThrow({ where: { id: pendingUserId } }),
      );
      const session = await auth.login(inactive);
      expect(session.tokens.user.status).toBe('INACTIVE');

      expect(() => activeGuard.canActivate(mockContext(inactive))).toThrow(
        ForbiddenException,
      );
    } finally {
      await prisma.user.update({
        where: { id: pendingUserId },
        data: { status: 'PENDING' },
      });
    }
  });

  it('signup stores organizationId as requestedOrganizationId without session tokens', async () => {
    const email = `signup-${suffix}@example.com`;
    const result = await auth.signup({
      email,
      password: 'SignupPass123!',
      name: 'Signup User',
      organizationId: orgId,
    });
    expect(result.user.status).toBe('PENDING');
    expect(result.user.requestedOrganizationId).toBe(orgId);
    expect(result).not.toHaveProperty('accessToken');
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.requestedOrganizationId).toBe(orgId);
    await prisma.user.delete({ where: { email } });
  });

  it('signup rejects unknown organizationId', async () => {
    await expect(
      auth.signup({
        email: `bad-org-${suffix}@example.com`,
        password: 'SignupPass123!',
        name: 'Bad Org User',
        organizationId: 'nonexistent-org-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
