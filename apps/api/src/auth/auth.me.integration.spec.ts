import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { PublicUserSchema } from '@greekgeek/contracts';
import { MembershipsService } from '../memberships/memberships.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PermissionsService } from '../permissions/permissions.service';
import { UniversitiesService } from '../universities/universities.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)('Auth me membership and permissions', () => {
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

  const suffix = Date.now();
  let universityId = '';
  let organizationId = '';
  let organizationName = '';
  let officerUserId = '';
  let adminUserId = '';

  beforeAll(async () => {
    const uni = await universities.create({
      name: `Auth Me Uni ${suffix}`,
    });
    universityId = uni.id;

    const org = await organizations.create({
      name: `Auth Me Org ${suffix}`,
      type: 'FRATERNITY',
      universityId,
    });
    organizationId = org.id;
    organizationName = org.name;

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
        email: `officer-me-${suffix}@example.com`,
        name: 'Officer Me',
        passwordHash: await passwords.hash('OfficerPass123!'),
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    officerUserId = officer.id;

    const membership = await memberships.assign({
      userId: officerUserId,
      organizationId,
    });
    await permissions.grant(membership.id, {
      permissionKey: 'members.manage_permissions',
    });

    const admin = await prisma.user.create({
      data: {
        email: `admin-me-${suffix}@example.com`,
        name: 'Admin Me',
        passwordHash: await passwords.hash('AdminPass123!'),
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    adminUserId = admin.id;
  });

  afterAll(async () => {
    await prisma.memberPermission.deleteMany({
      where: { membership: { organizationId } },
    });
    await prisma.membership.deleteMany({ where: { organizationId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.university.deleteMany({ where: { id: universityId } });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: [officerUserId, adminUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [officerUserId, adminUserId] } },
    });
    await prisma.$disconnect();
  });

  it('officer with members.manage_permissions sees key and organizationId on me', async () => {
    const me = await auth.getPublicUserById(officerUserId);
    expect(me).not.toBeNull();
    const parsed = PublicUserSchema.parse(me);
    expect(parsed.membership).toEqual({
      organizationId,
      organizationName,
    });
    expect(parsed.permissions).toContain('members.manage_permissions');
  });

  it('ADMIN me has null membership and empty permissions', async () => {
    const me = await auth.getPublicUserById(adminUserId);
    expect(me).not.toBeNull();
    const parsed = PublicUserSchema.parse(me);
    expect(parsed.membership).toBeNull();
    expect(parsed.permissions).toEqual([]);
  });
});
