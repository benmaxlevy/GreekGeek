import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { OrganizationsService } from '../organizations/organizations.service';
import { UniversitiesService } from '../universities/universities.service';
import { PermissionsService } from '../permissions/permissions.service';
import { MembershipsService } from '../memberships/memberships.service';
import { OrgPermissionGuard } from '../permissions/guards/org-permission.guard';
import { EventsService } from '../events/events.service';
import type { PublicUser } from '../auth/types/auth.dto';

const hasDatabase = Boolean(process.env.DATABASE_URL);

function mockContext(
  user?: PublicUser,
  extras?: {
    params?: Record<string, string>;
    body?: Record<string, unknown>;
    permissionKey?: string;
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

(hasDatabase ? describe : describe.skip)('Events API integration', () => {
  const prisma = new PrismaClient();
  const universities = new UniversitiesService(prisma as never);
  const organizations = new OrganizationsService(prisma as never);
  const memberships = new MembershipsService(prisma as never);
  const permissions = new PermissionsService(prisma as never);
  const events = new EventsService(prisma as never);

  let createGuard: OrgPermissionGuard;
  const suffix = Date.now();
  let universityId = '';
  let orgAId = '';
  let orgBId = '';
  let creatorUserId = '';
  let creatorMembershipId = '';
  let managerUserId = '';
  let managerMembershipId = '';
  let noPermUserId = '';

  function asUser(
    id: string,
    role: 'USER' | 'ADMIN' = 'USER',
  ): PublicUser {
    return {
      id,
      email: `${id}@example.com`,
      name: 'Test',
      role,
      status: 'ACTIVE',
      requestedOrganizationId: null,
      membership: null,
      permissions: [],
    };
  }

  beforeAll(async () => {
    createGuard = new OrgPermissionGuard(
      {
        getAllAndOverride: () => ({
          permissionKey: 'events.create',
        }),
      } as unknown as Reflector,
      prisma as never,
    );

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

    const uni = await universities.create({
      name: `Events Test Uni ${suffix}`,
    });
    universityId = uni.id;
    orgAId = (
      await organizations.create({
        name: `Events Org A ${suffix}`,
        type: 'FRATERNITY',
        universityId,
      })
    ).id;
    orgBId = (
      await organizations.create({
        name: `Events Org B ${suffix}`,
        type: 'SORORITY',
        universityId,
      })
    ).id;

    const creator = await prisma.user.create({
      data: {
        email: `evt-creator-${suffix}@example.com`,
        name: 'Creator',
        passwordHash: 'x',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    creatorUserId = creator.id;
    const creatorMembership = await memberships.assign({
      userId: creatorUserId,
      organizationId: orgAId,
    });
    creatorMembershipId = creatorMembership.id;
    await permissions.grant(creatorMembershipId, {
      permissionKey: 'events.create',
    });

    const manager = await prisma.user.create({
      data: {
        email: `evt-manager-${suffix}@example.com`,
        name: 'Manager',
        passwordHash: 'x',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    managerUserId = manager.id;
    const managerMembership = await memberships.assign({
      userId: managerUserId,
      organizationId: orgAId,
    });
    // replace: only one membership per user - wait, creator already in orgA.
    // Manager needs own user - memberships.assign should work for different user.
    managerMembershipId = managerMembership.id;
    await permissions.grant(managerMembershipId, {
      permissionKey: 'events.manage',
    });
    await permissions.grant(managerMembershipId, {
      permissionKey: 'events.create',
    });

    const noPerm = await prisma.user.create({
      data: {
        email: `evt-noperm-${suffix}@example.com`,
        name: 'NoPerm',
        passwordHash: 'x',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    noPermUserId = noPerm.id;
    await memberships.assign({
      userId: noPermUserId,
      organizationId: orgAId,
    });
  });

  afterAll(async () => {
    await prisma.event.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.memberPermission.deleteMany({
      where: {
        membership: { organizationId: { in: [orgAId, orgBId] } },
      },
    });
    await prisma.membership.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [creatorUserId, managerUserId, noPermUserId] },
      },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
    await prisma.university.delete({ where: { id: universityId } });
    await prisma.$disconnect();
  });

  it('creator with events.create can create; no-perm cannot list', async () => {
    const body = {
      organizationId: orgAId,
      name: `Formal ${suffix}`,
      type: 'Fraternity Formal',
      maxHeadcount: 80,
      location: 'Nashville',
    };
    await expect(
      createGuard.canActivate(
        mockContext(asUser(creatorUserId), { body }),
      ),
    ).resolves.toBe(true);

    const created = await events.create(body, asUser(creatorUserId));
    expect(created.organizationId).toBe(orgAId);
    expect(created.maxHeadcount).toBe(80);

    await expect(events.list({}, asUser(noPermUserId))).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const listed = await events.list({}, asUser(creatorUserId));
    expect(listed.some((e) => e.id === created.id)).toBe(true);
  });

  it('create-only cannot update; manage can; org isolation', async () => {
    const created = await events.create(
      {
        organizationId: orgAId,
        name: `Party ${suffix}`,
        type: 'Date Party',
        maxHeadcount: 40,
      },
      asUser(creatorUserId),
    );

    await expect(
      events.update(created.id, { name: 'Nope' }, asUser(creatorUserId)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const updated = await events.update(
      created.id,
      { name: 'Updated Party', location: null },
      asUser(managerUserId),
    );
    expect(updated.name).toBe('Updated Party');
    expect(updated.location).toBeNull();

    // org B event not visible to org A member
    const admin = asUser('admin-fake', 'ADMIN');
    const other = await events.create(
      {
        organizationId: orgBId,
        name: `Other ${suffix}`,
        type: 'Concert',
        maxHeadcount: 10,
      },
      admin,
    );
    const orgAList = await events.list({}, asUser(managerUserId));
    expect(orgAList.some((e) => e.id === other.id)).toBe(false);

    await events.remove(other.id, admin);
    await events.remove(created.id, asUser(managerUserId));
  });

  it('admin lists by org; org delete 409 with events', async () => {
    const admin = asUser('admin-fake', 'ADMIN');
    const ev = await events.create(
      {
        organizationId: orgBId,
        name: `Block delete ${suffix}`,
        type: 'Other',
        maxHeadcount: 5,
      },
      admin,
    );
    const filtered = await events.list({ organizationId: orgBId }, admin);
    expect(filtered.every((e) => e.organizationId === orgBId)).toBe(true);
    expect(filtered.some((e) => e.id === ev.id)).toBe(true);

    await expect(organizations.remove(orgBId)).rejects.toBeInstanceOf(
      ConflictException,
    );

    await events.remove(ev.id, admin);
  });

  it('create guard rejects member without events.create', async () => {
    await expect(
      createGuard.canActivate(
        mockContext(asUser(noPermUserId), {
          body: { organizationId: orgAId },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
