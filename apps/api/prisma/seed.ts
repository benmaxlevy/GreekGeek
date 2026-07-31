import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@rally.local';
const ADMIN_PASSWORD = 'RallyAdmin123!';
const ADMIN_NAME = 'Rally Admin';

async function main() {
  const passwordHash = await argon2.hash(ADMIN_PASSWORD);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      role: 'ADMIN',
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log(`Seeded admin user ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
