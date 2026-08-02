import { spawnSync } from 'node:child_process';
import path from 'node:path';

const API_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../../api',
);

function runPrismaScript(fnBody) {
  const code = `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  ${fnBody}
}
main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
`;
  const res = spawnSync('node', ['--input-type=module', '-e', code], {
    cwd: API_DIR,
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    throw new Error(res.stderr || res.stdout || 'Prisma script failed');
  }
}

/** Reset seed org Connect fields to not-started defaults. */
export function resetOrgStripeConnect(orgId) {
  runPrismaScript(`
    await prisma.organization.update({
      where: { id: ${JSON.stringify(orgId)} },
      data: {
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
        stripeRequirementsDue: null,
        stripeAccountUpdatedAt: null,
      },
    });
  `);
}

/** Demo fallback when Stripe Accounts v2 hosted onboarding is unavailable. */
export function setOrgStripeReady(orgId, { accountId = 'acct_demo_ready' } = {}) {
  runPrismaScript(`
    await prisma.organization.update({
      where: { id: ${JSON.stringify(orgId)} },
      data: {
        stripeAccountId: ${JSON.stringify(accountId)},
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeDetailsSubmitted: true,
        stripeRequirementsDue: null,
        stripeAccountUpdatedAt: new Date(),
      },
    });
  `);
}

export function setOrgStripeChargesEnabled(orgId, enabled) {
  runPrismaScript(`
    await prisma.organization.update({
      where: { id: ${JSON.stringify(orgId)} },
      data: { stripeChargesEnabled: ${enabled} },
    });
  `);
}
