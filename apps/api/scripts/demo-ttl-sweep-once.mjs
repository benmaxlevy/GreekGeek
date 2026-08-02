/**
 * Backdate purchase + release held seats (demo TTL sweep without waiting 5 min).
 * Usage: node scripts/demo-ttl-sweep-once.mjs <purchaseId>
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const purchaseId = process.argv[2];
if (!purchaseId) {
  console.error('usage: node scripts/demo-ttl-sweep-once.mjs <purchaseId>');
  process.exit(1);
}

const API_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
);

const code = `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const purchaseId = ${JSON.stringify(purchaseId)};
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase || purchase.status !== 'requires_payment') {
    console.error('Purchase not open:', purchase?.status);
    process.exit(1);
  }
  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { createdAt: new Date(Date.now() - 10 * 60_000) },
  });
  const deleted = await prisma.ticket.deleteMany({
    where: { purchaseId, status: 'unpaid' },
  });
  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { status: 'canceled' },
  });
  console.log('Released purchase', purchaseId, 'deleted tickets', deleted.count);
}
main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
`;

const res = spawnSync('node', ['--input-type=module', '-e', code], {
  cwd: API_DIR,
  encoding: 'utf8',
  env: process.env,
});
if (res.stdout) process.stdout.write(res.stdout);
if (res.stderr) process.stderr.write(res.stderr);
process.exit(res.status ?? 1);
