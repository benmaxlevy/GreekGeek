import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { UniversitiesService } from '../universities/universities.service';
import { UsersLifecycleService } from './users-lifecycle.service';

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)('Admin users integration', () => {
  const prisma = new PrismaClient();
  const passwords = new PasswordService();
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET ?? 'test-jwt-secret-min-16-chars',
  });
  const auth = new AuthService(prisma as never, passwords, jwt);
  const universities = new UniversitiesService(prisma as never);
  const organizations = new OrganizationsService(prisma as never);
  const usersLifecycle = new UsersLifecycleService(prisma as never, auth);

  const suffix = `admin-users-${Date.now()}`;
  let universityId = '';
  let orgAId = '';
  let orgBId = '';
  let pendingUserId = '';

  beforeAll(async () => {
    const uni = await universities.create({
      name: `Admin Users Uni ${suffix}`,
    });
    universityId = uni.id;

    const orgA = await organizations.create({
      name: `Admin Users Org A ${suffix}`,
      type: 'FRATERNITY',
      universityId,
    });
    orgAId = orgA.id;

    const orgB = await organizations.create({
      name: `Admin Users Org B ${suffix}`,
      type: 'SORORITY',
      universityId,
    });
    orgBId = orgB.id;

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
      where: { userId: pendingUserId },
    });
    await prisma.user.deleteMany({ where: { id: pendingUserId } });
    await prisma.$disconnect();
  });

  it('approve requires organizationId when none requested; deny, deactivate, and reactivate work', async () => {
    await prisma.user.update({
      where: { id: pendingUserId },
      data: { status: 'PENDING', requestedOrganizationId: null },
    });

    await expect(
      usersLifecycle.patchStatus(pendingUserId, { status: 'ACTIVE' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const denied = await usersLifecycle.patchStatus(pendingUserId, {
      status: 'INACTIVE',
    });
    expect(denied.status).toBe('INACTIVE');

    await expect(
      usersLifecycle.patchStatus(pendingUserId, {
        status: 'ACTIVE',
        organizationId: orgAId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const reactivated = await usersLifecycle.patchStatus(pendingUserId, {
      status: 'ACTIVE',
    });
    expect(reactivated.status).toBe('ACTIVE');
    const membershipAfterReactivate = await prisma.membership.findUnique({
      where: { userId: pendingUserId },
    });
    expect(membershipAfterReactivate).toBeNull();

    const deactivated = await usersLifecycle.patchStatus(pendingUserId, {
      status: 'INACTIVE',
    });
    expect(deactivated.status).toBe('INACTIVE');

    await usersLifecycle.patchStatus(pendingUserId, { status: 'ACTIVE' });

    await prisma.user.update({
      where: { id: pendingUserId },
      data: { status: 'PENDING', requestedOrganizationId: null },
    });

    const approved = await usersLifecycle.patchStatus(pendingUserId, {
      status: 'ACTIVE',
      organizationId: orgBId,
    });
    expect(approved.status).toBe('ACTIVE');
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { userId: pendingUserId },
    });
    expect(membership.organizationId).toBe(orgBId);
    const grants = await prisma.memberPermission.count({
      where: { membershipId: membership.id },
    });
    expect(grants).toBe(0);
  });

  it('approve defaults to requestedOrganizationId; body organizationId overrides', async () => {
    await prisma.membership.deleteMany({ where: { userId: pendingUserId } });
    await prisma.user.update({
      where: { id: pendingUserId },
      data: {
        status: 'PENDING',
        requestedOrganizationId: orgAId,
      },
    });

    const approvedDefault = await usersLifecycle.patchStatus(pendingUserId, {
      status: 'ACTIVE',
    });
    expect(approvedDefault.status).toBe('ACTIVE');
    expect(
      (
        await prisma.membership.findUniqueOrThrow({
          where: { userId: pendingUserId },
        })
      ).organizationId,
    ).toBe(orgAId);

    await prisma.membership.deleteMany({ where: { userId: pendingUserId } });
    await prisma.user.update({
      where: { id: pendingUserId },
      data: {
        status: 'PENDING',
        requestedOrganizationId: orgAId,
      },
    });

    const approvedOverride = await usersLifecycle.patchStatus(pendingUserId, {
      status: 'ACTIVE',
      organizationId: orgBId,
    });
    expect(approvedOverride.status).toBe('ACTIVE');
    expect(
      (
        await prisma.membership.findUniqueOrThrow({
          where: { userId: pendingUserId },
        })
      ).organizationId,
    ).toBe(orgBId);
  });
});
