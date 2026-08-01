import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../auth/password.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { UniversitiesService } from '../universities/universities.service';
import { MembershipsService } from './memberships.service';

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)('Memberships integration', () => {
  const prisma = new PrismaClient();
  const passwords = new PasswordService();
  const universities = new UniversitiesService(prisma as never);
  const organizations = new OrganizationsService(prisma as never);
  const memberships = new MembershipsService(prisma as never);

  const suffix = `memberships-${Date.now()}`;
  let universityId = '';
  let orgAId = '';
  let orgBId = '';
  let activeUserId = '';

  beforeAll(async () => {
    const uni = await universities.create({
      name: `Memberships Uni ${suffix}`,
    });
    universityId = uni.id;

    const orgA = await organizations.create({
      name: `Memberships Org A ${suffix}`,
      type: 'FRATERNITY',
      universityId,
    });
    orgAId = orgA.id;

    const orgB = await organizations.create({
      name: `Memberships Org B ${suffix}`,
      type: 'SORORITY',
      universityId,
    });
    orgBId = orgB.id;

    const active = await prisma.user.create({
      data: {
        email: `active-${suffix}@example.com`,
        name: 'Active Member',
        passwordHash: await passwords.hash('ActivePass123!'),
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    activeUserId = active.id;

    await memberships.assign({
      userId: activeUserId,
      organizationId: orgBId,
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
    await prisma.user.deleteMany({ where: { id: activeUserId } });
    await prisma.$disconnect();
  });

  it('membership assign atomically replaces existing membership', async () => {
    const replaced = await memberships.assign({
      userId: activeUserId,
      organizationId: orgAId,
    });
    expect(replaced.organizationId).toBe(orgAId);
    const count = await prisma.membership.count({
      where: { userId: activeUserId },
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

  it('rejects membership assign for non-ACTIVE users', async () => {
    await prisma.user.update({
      where: { id: activeUserId },
      data: { status: 'PENDING' },
    });
    await expect(
      memberships.assign({
        userId: activeUserId,
        organizationId: orgAId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await prisma.user.update({
      where: { id: activeUserId },
      data: { status: 'ACTIVE' },
    });
  });
});
