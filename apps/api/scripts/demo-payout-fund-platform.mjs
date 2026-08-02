/**
 * Add Stripe test-mode available balance for Connect transfers (tok_bypassPending).
 * Usage: node scripts/demo-payout-fund-platform.mjs [amountCents]
 */
import Stripe from 'stripe';

const amountCents = Number(process.argv[2] ?? 100_000);
if (!Number.isFinite(amountCents) || amountCents <= 0) {
  console.error('usage: node scripts/demo-payout-fund-platform.mjs [amountCents]');
  process.exit(1);
}

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY required');
  process.exit(1);
}

const stripe = new Stripe(key, {
  apiVersion: process.env.STRIPE_API_VERSION ?? '2026-07-29.preview',
});

const charge = await stripe.charges.create({
  amount: amountCents,
  currency: 'usd',
  source: 'tok_bypassPending',
});
const balance = await stripe.balance.retrieve();
console.log(
  JSON.stringify({
    chargeId: charge.id,
    availableUsd: balance.available.find((row) => row.currency === 'usd')?.amount ?? 0,
  }),
);
