import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@rally.local';
const ADMIN_PASSWORD = 'RallyAdmin123!';
const ADMIN_NAME = 'Rally Admin';

const PERMISSIONS = [
  {
    key: 'members.manage_permissions',
    description: 'Grant and revoke permissions within the organization',
  },
  {
    key: 'events.create',
    description: 'Create events for the organization',
  },
  {
    key: 'events.manage',
    description: 'Manage existing events for the organization',
  },
] as const;

async function main() {
  const passwordHash = await argon2.hash(ADMIN_PASSWORD);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`Seeded admin user ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }
  console.log(`Seeded ${PERMISSIONS.length} permissions`);

  const university = await prisma.university.upsert({
    where: { id: 'seed-university-demo' },
    update: { name: 'Demo State University' },
    create: {
      id: 'seed-university-demo',
      name: 'Demo State University',
    },
  });

  await prisma.organization.upsert({
    where: {
      universityId_name: {
        universityId: university.id,
        name: 'Alpha Demo Fraternity',
      },
    },
    update: { type: 'FRATERNITY' },
    create: {
      name: 'Alpha Demo Fraternity',
      type: 'FRATERNITY',
      universityId: university.id,
    },
  });
  console.log('Seeded sample university + organization');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
