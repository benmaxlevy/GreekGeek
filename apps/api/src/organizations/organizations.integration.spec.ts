import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../auth/password.service';
import { MembershipsService } from '../memberships/memberships.service';
import { UniversitiesService } from '../universities/universities.service';
import { OrganizationsService } from './organizations.service';

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)('Organizations integration', () => {
  const prisma = new PrismaClient();
  const passwords = new PasswordService();
  const universities = new UniversitiesService(prisma as never);
  const organizations = new OrganizationsService(prisma as never);
  const memberships = new MembershipsService(prisma as never);

  const suffix = `organizations-${Date.now()}`;
  let universityId = '';
  let orgId = '';
  let memberUserId = '';

  beforeAll(async () => {
    const uni = await universities.create({
      name: `Organizations Uni ${suffix}`,
    });
    universityId = uni.id;

    const org = await organizations.create({
      name: `Organizations Org ${suffix}`,
      type: 'FRATERNITY',
      universityId,
    });
    orgId = org.id;

    const member = await prisma.user.create({
      data: {
        email: `member-${suffix}@example.com`,
        name: 'Org Member',
        passwordHash: await passwords.hash('MemberPass123!'),
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    memberUserId = member.id;

    await memberships.assign({
      userId: memberUserId,
      organizationId: orgId,
    });
  });

  afterAll(async () => {
    await prisma.memberPermission.deleteMany({
      where: { membership: { organizationId: orgId } },
    });
    await prisma.membership.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.university.deleteMany({ where: { id: universityId } });
    await prisma.user.deleteMany({ where: { id: memberUserId } });
    await prisma.$disconnect();
  });

  it('organization delete with dependents returns 409', async () => {
    await expect(organizations.remove(orgId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
