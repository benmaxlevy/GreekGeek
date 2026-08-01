import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { PasswordService } from '../auth/password.service';
import type { PublicUser } from '../auth/types/auth.dto';
import { MembershipsService } from '../memberships/memberships.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { UniversitiesService } from '../universities/universities.service';
import { OrgPermissionGuard } from './guards/org-permission.guard';
import { PermissionsService } from './permissions.service';

const hasDatabase = Boolean(process.env.DATABASE_URL);

function mockContext(
  user?: PublicUser,
  extras?: {
    params?: Record<string, string>;
  },
): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        params: extras?.params ?? {},
        body: {},
      }),
    }),
  } as unknown as ExecutionContext;
}

(hasDatabase ? describe : describe.skip)('Permissions integration', () => {
  const prisma = new PrismaClient();
  const passwords = new PasswordService();
  const universities = new UniversitiesService(prisma as never);
  const organizations = new OrganizationsService(prisma as never);
  const memberships = new MembershipsService(prisma as never);
  const permissions = new PermissionsService(prisma as never);
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

  const suffix = `permissions-${Date.now()}`;
  let universityId = '';
  let orgAId = '';
  let orgBId = '';
  let activeMemberId = '';
  let managerUserId = '';
  let outsideUserId = '';
  let managerMembershipId = '';
  let targetMembershipId = '';
  let outsideMembershipId = '';

  beforeAll(async () => {
    const uni = await universities.create({
      name: `Permissions Uni ${suffix}`,
    });
    universityId = uni.id;

    const orgA = await organizations.create({
      name: `Permissions Org A ${suffix}`,
      type: 'FRATERNITY',
      universityId,
    });
    orgAId = orgA.id;

    const orgB = await organizations.create({
      name: `Permissions Org B ${suffix}`,
      type: 'SORORITY',
      universityId,
    });
    orgBId = orgB.id;

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

    const outside = await prisma.user.create({
      data: {
        email: `outside-${suffix}@example.com`,
        name: 'Outside Member',
        passwordHash: await passwords.hash('OutsidePass123!'),
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    outsideUserId = outside.id;

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

    const outsideMembership = await memberships.assign({
      userId: outsideUserId,
      organizationId: orgBId,
    });
    outsideMembershipId = outsideMembership.id;

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
    await prisma.user.deleteMany({
      where: {
        id: { in: [activeMemberId, managerUserId, outsideUserId] },
      },
    });
    await prisma.$disconnect();
  });

  it('ADMIN bypasses org permission guard', async () => {
    const admin: PublicUser = {
      id: 'admin-test',
      email: 'admin@test.local',
      name: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      requestedOrganizationId: null,
      membership: null,
      permissions: [],
    };
    await expect(
      orgPermissionGuard.canActivate(
        mockContext(admin, { params: { membershipId: targetMembershipId } }),
      ),
    ).resolves.toBe(true);
  });

  it('grant gate without members.manage_permissions returns 403', async () => {
    const plainMember: PublicUser = {
      id: activeMemberId,
      email: `active-${suffix}@example.com`,
      name: 'Active Member',
      role: 'USER',
      status: 'ACTIVE',
      requestedOrganizationId: null,
      membership: { organizationId: orgAId },
      permissions: [],
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
      requestedOrganizationId: null,
      membership: { organizationId: orgAId },
      permissions: ['members.manage_permissions'],
    };

    await expect(
      orgPermissionGuard.canActivate(
        mockContext(manager, { params: { membershipId: targetMembershipId } }),
      ),
    ).resolves.toBe(true);

    await expect(
      orgPermissionGuard.canActivate(
        mockContext(manager, {
          params: { membershipId: outsideMembershipId },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const granted = await permissions.grant(targetMembershipId, {
      permissionKey: 'events.create',
    });
    expect(granted.permissionKey).toBe('events.create');
  });

  it('rejects permission grants and revokes for non-ACTIVE members', async () => {
    await prisma.user.update({
      where: { id: outsideUserId },
      data: { status: 'PENDING' },
    });
    try {
      await expect(
        permissions.grant(outsideMembershipId, {
          permissionKey: 'events.manage',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        permissions.revoke(outsideMembershipId, 'events.create'),
      ).rejects.toBeInstanceOf(BadRequestException);
    } finally {
      await prisma.user.update({
        where: { id: outsideUserId },
        data: { status: 'ACTIVE' },
      });
    }
  });
});
