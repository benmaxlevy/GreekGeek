import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { OrganizationsService } from '../organizations/organizations.service';
import { UniversitiesService } from './universities.service';

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)('Universities integration', () => {
  const prisma = new PrismaClient();
  const universities = new UniversitiesService(prisma as never);
  const organizations = new OrganizationsService(prisma as never);

  const suffix = `universities-${Date.now()}`;
  let universityId = '';
  let orgId = '';

  beforeAll(async () => {
    const uni = await universities.create({
      name: `Universities Uni ${suffix}`,
    });
    universityId = uni.id;

    const org = await organizations.create({
      name: `Universities Org ${suffix}`,
      type: 'FRATERNITY',
      universityId,
    });
    orgId = org.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.university.deleteMany({ where: { id: universityId } });
    await prisma.$disconnect();
  });

  it('university delete with dependents returns 409', async () => {
    await expect(universities.remove(universityId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
