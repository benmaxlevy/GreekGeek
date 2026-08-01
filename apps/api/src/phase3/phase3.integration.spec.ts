import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { ActiveUserGuard } from '../auth/guards/active-user.guard';
import { Reflector } from '@nestjs/core';
import { AdminUsersService } from '../admin-users/admin-users.service';
import { MembershipsService } from '../memberships/memberships.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PermissionsService } from '../permissions/permissions.service';
import { OrgPermissionGuard } from '../permissions/guards/org-permission.guard';
import { UniversitiesService } from '../universities/universities.service';
import type { PublicUser } from '../auth/types/auth.dto';
import type { ExecutionContext } from '@nestjs/common';

const hasDatabase = Boolean(process.env.DATABASE_URL);

function mockContext(user?: PublicUser, extras?: {
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  handlerMeta?: Record<string, unknown>;
}): ExecutionContext {
  const handlerMeta = extras?.handlerMeta ?? {};
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        params: extras?.params ?? {},
        body: extras?.body ?? {},
      }),
    }),
    // used via Reflector override in tests below
    __handlerMeta: handlerMeta,
  } as unknown as ExecutionContext;
}

(hasDatabase ? describe : describe.skip)('Phase 3 API integration', () => {
  const prisma = new PrismaClient();
  const passwords = new PasswordService();
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET ?? 'test-jwt-secret-min-16-chars',
  });
  const auth = new AuthService(prisma as never, passwords, jwt);
  const universities = new UniversitiesService(prisma as never);
  const organizations = new OrganizationsService(prisma as never);
  const memberships = new MembershipsService(prisma as never);
  const permissions = new PermissionsService(prisma as never);
  const adminUsers = new AdminUsersService(prisma as never, auth);
  const orgPermissionGuard = new OrgPermissionGuard(
    {
      getAllAndOverride: (key: string) => {
        if (key === 'orgPermission') {
          return {
            permissionKey: 'members.manage_permissions',
            membershipParam: 'membershipId',
          };
        }
        return undefined;
      },
    } as unknown as Reflector,
    prisma as never,
  );
  const activeGuard = new ActiveUserGuard({
    getAllAndOverride: () => false,
  } as unknown as Reflector);

  const suffix = Date.now();
  let universityId = '';
  let orgAId = '';
  let orgBId = '';
  let pendingUserId = '';
  let activeMemberId = '';
  let managerUserId = '';
  let managerMembershipId = '';
  let targetMembershipId = '';

  beforeAll(async () => {
    const uni = await universities.create({
      name: `Phase3 Test Uni ${suffix}`,
    });
    universityId = uni.id;

    const orgA = await organizations.create({
      name: `Org A ${suffix}`,
      type: 'FRATERNITY',
      universityId,
    });
    orgAId = orgA.id;

    const orgB = await organizations.create({
      name: `Org B ${suffix}`,
      type: 'SORORITY',
      universityId,
    });
    orgBId = orgB.id;

    // Ensure catalog permissions exist
    for (const key of [
      'members.manage_permissions',
      'events.create',
      'events.manage',
    ] as const) {
      await prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key },
      });
    }

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

    const active = await prisma.user.create({
      data: {
        email: `active-${suffix}@example.com`,
        name: 'Active Member',
        passwordHash: await passwords.hash('ActivePass123!'),
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    activeMemberId = active.id;

    const manager = await prisma.user.create({
      data: {
        email: `manager-${suffix}@example.com`,
        name: 'Manager Member',
        passwordHash: await passwords.hash('ManagerPass123!'),
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    managerUserId = manager.id;

    const managerMembership = await memberships.assign({
      userId: managerUserId,
      organizationId: orgAId,
    });
    managerMembershipId = managerMembership.id;

    const targetMembership = await memberships.assign({
      userId: activeMemberId,
      organizationId: orgAId,
    });
    targetMembershipId = targetMembership.id;

    await permissions.grant(managerMembershipId, {
      permissionKey: 'members.manage_permissions',
    });
  });

  afterAll(async () => {
    await prisma.memberPermission.deleteMany({
      where: {
        membership: {
          organizationId: { in: [orgAId, orgBId] },
        },
      },
    });
    await prisma.membership.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
    await prisma.university.deleteMany({ where: { id: universityId } });
    await prisma.refreshToken.deleteMany({
      where: {
        userId: { in: [pendingUserId, activeMemberId, managerUserId] },
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [pendingUserId, activeMemberId, managerUserId] } },
    });
    await prisma.$disconnect();
  });

  it('12.4 PENDING login and refresh succeed; active guard blocks protected use', async () => {
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

  it('12.4 INACTIVE login succeeds; active guard blocks', async () => {
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

  it('fill requires organizationId; kill and reactivate work', async () => {
    await prisma.user.update({
      where: { id: pendingUserId },
      data: { status: 'PENDING' },
    });

    await expect(
      adminUsers.patchStatus(pendingUserId, { status: 'ACTIVE' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const killed = await adminUsers.patchStatus(pendingUserId, {
      status: 'INACTIVE',
    });
    expect(killed.status).toBe('INACTIVE');

    const reactivated = await adminUsers.patchStatus(pendingUserId, {
      status: 'ACTIVE',
    });
    expect(reactivated.status).toBe('ACTIVE');
    const membershipAfterReactivate = await prisma.membership.findUnique({
      where: { userId: pendingUserId },
    });
    expect(membershipAfterReactivate).toBeNull();

    await prisma.user.update({
      where: { id: pendingUserId },
      data: { status: 'PENDING' },
    });

    const filled = await adminUsers.patchStatus(pendingUserId, {
      status: 'ACTIVE',
      organizationId: orgBId,
    });
    expect(filled.status).toBe('ACTIVE');
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { userId: pendingUserId },
    });
    expect(membership.organizationId).toBe(orgBId);
    const grants = await prisma.memberPermission.count({
      where: { membershipId: membership.id },
    });
    expect(grants).toBe(0);
  });

  it('12.1 membership assign atomically replaces existing membership', async () => {
    const replaced = await memberships.assign({
      userId: pendingUserId,
      organizationId: orgAId,
    });
    expect(replaced.organizationId).toBe(orgAId);
    const count = await prisma.membership.count({
      where: { userId: pendingUserId },
    });
    expect(count).toBe(1);
  });

  it('rejects membership for ADMIN users', async () => {
    const admin = await prisma.user.findFirstOrThrow({
      where: { role: 'ADMIN' },
    });
    await expect(
      memberships.assign({
        userId: admin.id,
        organizationId: orgAId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('12.5 university/org delete with dependents returns 409', async () => {
    await expect(universities.remove(universityId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(organizations.remove(orgAId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('12.2 ADMIN bypasses org permission guard', async () => {
    const admin: PublicUser = {
      id: 'admin-test',
      email: 'admin@test.local',
      name: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    };
    await expect(
      orgPermissionGuard.canActivate(
        mockContext(admin, { params: { membershipId: targetMembershipId } }),
      ),
    ).resolves.toBe(true);
  });

  it('12.3 grant gate without members.manage_permissions returns 403', async () => {
    const plainMember: PublicUser = {
      id: activeMemberId,
      email: `active-${suffix}@example.com`,
      name: 'Active Member',
      role: 'USER',
      status: 'ACTIVE',
    };
    await expect(
      orgPermissionGuard.canActivate(
        mockContext(plainMember, {
          params: { membershipId: managerMembershipId },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('delegated manager grants in own org; cannot grant outside org', async () => {
    const manager: PublicUser = {
      id: managerUserId,
      email: `manager-${suffix}@example.com`,
      name: 'Manager Member',
      role: 'USER',
      status: 'ACTIVE',
    };

    await expect(
      orgPermissionGuard.canActivate(
        mockContext(manager, { params: { membershipId: targetMembershipId } }),
      ),
    ).resolves.toBe(true);

    const otherOrgMembership = await prisma.membership.findUniqueOrThrow({
      where: { userId: pendingUserId },
    });
    // pending user was moved to orgA in replace test — move to orgB for outside-org check
    await memberships.assign({
      userId: pendingUserId,
      organizationId: orgBId,
    });
    const orgBMembership = await prisma.membership.findUniqueOrThrow({
      where: { userId: pendingUserId },
    });
    expect(orgBMembership.organizationId).toBe(orgBId);
    void otherOrgMembership;

    await expect(
      orgPermissionGuard.canActivate(
        mockContext(manager, {
          params: { membershipId: orgBMembership.id },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const granted = await permissions.grant(targetMembershipId, {
      permissionKey: 'events.create',
    });
    expect(granted.permissionKey).toBe('events.create');
  });

  it('rejects permission grants for non-ACTIVE members', async () => {
    await prisma.user.update({
      where: { id: pendingUserId },
      data: { status: 'PENDING' },
    });
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { userId: pendingUserId },
    });
    await expect(
      permissions.grant(membership.id, { permissionKey: 'events.manage' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await prisma.user.update({
      where: { id: pendingUserId },
      data: { status: 'ACTIVE' },
    });
  });

  it('signup creates PENDING user without session tokens', async () => {
    const email = `signup-${suffix}@example.com`;
    const result = await auth.signup({
      email,
      password: 'SignupPass123!',
      name: 'Signup User',
    });
    expect(result.user.status).toBe('PENDING');
    expect(result).not.toHaveProperty('accessToken');
    await prisma.user.delete({ where: { email } });
  });
});
