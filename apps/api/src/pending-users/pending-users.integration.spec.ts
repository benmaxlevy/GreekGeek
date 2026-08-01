import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { AdminUsersService } from '../admin-users/admin-users.service';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { PublicUser } from '../auth/types/auth.dto';
import { MembershipsService } from '../memberships/memberships.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { OrgPermissionGuard } from '../permissions/guards/org-permission.guard';
import { ORG_PERMISSION_KEY } from '../permissions/decorators/require-org-permission.decorator';
import { PermissionsService } from '../permissions/permissions.service';
import { UniversitiesService } from '../universities/universities.service';
import { PendingUsersService } from './pending-users.service';
import type { ExecutionContext } from '@nestjs/common';

const hasDatabase = Boolean(process.env.DATABASE_URL);

function mockContext(
  user?: PublicUser,
  extras?: {
    params?: Record<string, string>;
    body?: Record<string, unknown>;
  },
): ExecutionContext {
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
  } as unknown as ExecutionContext;
}

(hasDatabase ? describe : describe.skip)(
  'Org officer pending approvals API',
  () => {
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
    const pendingUsers = new PendingUsersService(
      prisma as never,
      auth,
      adminUsers,
    );

    const orgPermissionMeta = {
      permissionKey: 'members.manage_permissions',
      organizationIdParam: 'organizationId',
    };
    const orgPermissionGuard = new OrgPermissionGuard(
      {
        getAllAndOverride: (key: string) => {
          if (key === ORG_PERMISSION_KEY) {
            return orgPermissionMeta;
          }
          return undefined;
        },
      } as unknown as Reflector,
      prisma as never,
    );

    const rolesGuard = new RolesGuard({
      getAllAndOverride: (key: string) => {
        if (key === ROLES_KEY) {
          return ['ADMIN'];
        }
        return undefined;
      },
    } as unknown as Reflector);

    const suffix = Date.now();
    let universityId = '';
    let orgAId = '';
    let orgBId = '';
    let officerUserId = '';
    let plainMemberId = '';
    let pendingAId = '';
    let pendingBId = '';

    const officerUser = (): PublicUser => ({
      id: officerUserId,
      email: `officer-pa-${suffix}@example.com`,
      name: 'Officer',
      role: 'USER',
      status: 'ACTIVE',
      requestedOrganizationId: null,
      membership: { organizationId: orgAId },
      permissions: ['members.manage_permissions'],
    });

    const plainMember = (): PublicUser => ({
      id: plainMemberId,
      email: `plain-pa-${suffix}@example.com`,
      name: 'Plain Member',
      role: 'USER',
      status: 'ACTIVE',
      requestedOrganizationId: null,
      membership: { organizationId: orgAId },
      permissions: [],
    });

    const adminUser = (): PublicUser => ({
      id: 'admin-pa-test',
      email: 'admin-pa@test.local',
      name: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      requestedOrganizationId: null,
      membership: null,
      permissions: [],
    });

    beforeAll(async () => {
      const uni = await universities.create({
        name: `Pending Approvals Uni ${suffix}`,
      });
      universityId = uni.id;

      const orgA = await organizations.create({
        name: `PA Org A ${suffix}`,
        type: 'FRATERNITY',
        universityId,
      });
      orgAId = orgA.id;

      const orgB = await organizations.create({
        name: `PA Org B ${suffix}`,
        type: 'SORORITY',
        universityId,
      });
      orgBId = orgB.id;

      await prisma.permission.upsert({
        where: { key: 'members.manage_permissions' },
        update: {},
        create: {
          key: 'members.manage_permissions',
          description: 'members.manage_permissions',
        },
      });

      const officer = await prisma.user.create({
        data: {
          email: `officer-pa-${suffix}@example.com`,
          name: 'Officer',
          passwordHash: await passwords.hash('OfficerPass123!'),
          role: 'USER',
          status: 'ACTIVE',
        },
      });
      officerUserId = officer.id;

      const plain = await prisma.user.create({
        data: {
          email: `plain-pa-${suffix}@example.com`,
          name: 'Plain Member',
          passwordHash: await passwords.hash('PlainPass123!'),
          role: 'USER',
          status: 'ACTIVE',
        },
      });
      plainMemberId = plain.id;

      const officerMembership = await memberships.assign({
        userId: officerUserId,
        organizationId: orgAId,
      });
      await permissions.grant(officerMembership.id, {
        permissionKey: 'members.manage_permissions',
      });

      await memberships.assign({
        userId: plainMemberId,
        organizationId: orgAId,
      });

      const pendingA = await prisma.user.create({
        data: {
          email: `pending-a-${suffix}@example.com`,
          name: 'Pending A',
          passwordHash: await passwords.hash('PendingPass123!'),
          role: 'USER',
          status: 'PENDING',
          requestedOrganizationId: orgAId,
        },
      });
      pendingAId = pendingA.id;

      const pendingB = await prisma.user.create({
        data: {
          email: `pending-b-${suffix}@example.com`,
          name: 'Pending B',
          passwordHash: await passwords.hash('PendingPass123!'),
          role: 'USER',
          status: 'PENDING',
          requestedOrganizationId: orgBId,
        },
      });
      pendingBId = pendingB.id;
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
          userId: {
            in: [officerUserId, plainMemberId, pendingAId, pendingBId],
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: { in: [officerUserId, plainMemberId, pendingAId, pendingBId] },
        },
      });
      await prisma.$disconnect();
    });

    it('3.1 officer lists only matching-org PENDING users', async () => {
      const listed = await pendingUsers.list(orgAId, {});
      expect(listed.map((u) => u.id)).toEqual([pendingAId]);
      expect(listed.every((u) => u.status === 'PENDING')).toBe(true);
      expect(
        listed.every((u) => u.requestedOrganizationId === orgAId),
      ).toBe(true);
    });

    it('3.2 officer approve creates membership to requested org and sets ACTIVE', async () => {
      const approved = await pendingUsers.patchStatus(
        orgAId,
        pendingAId,
        { status: 'ACTIVE' },
        officerUser(),
      );
      expect(approved.status).toBe('ACTIVE');
      const membership = await prisma.membership.findUniqueOrThrow({
        where: { userId: pendingAId },
      });
      expect(membership.organizationId).toBe(orgAId);
      const grants = await prisma.memberPermission.count({
        where: { membershipId: membership.id },
      });
      expect(grants).toBe(0);

      // reset for later tests that need a pending A applicant
      await prisma.membership.delete({ where: { id: membership.id } });
      await prisma.user.update({
        where: { id: pendingAId },
        data: { status: 'PENDING', requestedOrganizationId: orgAId },
      });
    });

    it('3.3 officer deny sets INACTIVE without membership', async () => {
      const denied = await pendingUsers.patchStatus(
        orgAId,
        pendingAId,
        { status: 'INACTIVE' },
        officerUser(),
      );
      expect(denied.status).toBe('INACTIVE');
      const membership = await prisma.membership.findUnique({
        where: { userId: pendingAId },
      });
      expect(membership).toBeNull();

      await prisma.user.update({
        where: { id: pendingAId },
        data: { status: 'PENDING', requestedOrganizationId: orgAId },
      });
    });

    it('3.4 403 without members.manage_permissions; 403 listing another org', async () => {
      await expect(
        orgPermissionGuard.canActivate(
          mockContext(plainMember(), {
            params: { organizationId: orgAId },
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      await expect(
        orgPermissionGuard.canActivate(
          mockContext(officerUser(), {
            params: { organizationId: orgBId },
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      await expect(
        orgPermissionGuard.canActivate(
          mockContext(officerUser(), {
            params: { organizationId: orgAId },
          }),
        ),
      ).resolves.toBe(true);
    });

    it('3.5 officer cannot approve applicant whose requestedOrganizationId differs from path org', async () => {
      await expect(
        pendingUsers.patchStatus(
          orgAId,
          pendingBId,
          { status: 'ACTIVE' },
          officerUser(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const stillPending = await prisma.user.findUniqueOrThrow({
        where: { id: pendingBId },
      });
      expect(stillPending.status).toBe('PENDING');
    });

    it('3.6 officer organizationId override rejected; ADMIN override works', async () => {
      await expect(
        pendingUsers.patchStatus(
          orgAId,
          pendingAId,
          { status: 'ACTIVE', organizationId: orgBId },
          officerUser(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      const stillPending = await prisma.user.findUniqueOrThrow({
        where: { id: pendingAId },
      });
      expect(stillPending.status).toBe('PENDING');

      const approved = await pendingUsers.patchStatus(
        orgAId,
        pendingAId,
        { status: 'ACTIVE', organizationId: orgBId },
        adminUser(),
      );
      expect(approved.status).toBe('ACTIVE');
      const membership = await prisma.membership.findUniqueOrThrow({
        where: { userId: pendingAId },
      });
      expect(membership.organizationId).toBe(orgBId);

      await prisma.membership.delete({ where: { id: membership.id } });
      await prisma.user.update({
        where: { id: pendingAId },
        data: { status: 'PENDING', requestedOrganizationId: orgAId },
      });
    });

    it('3.7 non-ADMIN still blocked from admin user-status API', async () => {
      expect(() =>
        rolesGuard.canActivate(mockContext(officerUser())),
      ).toThrow(ForbiddenException);

      expect(() =>
        rolesGuard.canActivate(mockContext(plainMember())),
      ).toThrow(ForbiddenException);

      expect(rolesGuard.canActivate(mockContext(adminUser()))).toBe(true);
    });
  },
);
