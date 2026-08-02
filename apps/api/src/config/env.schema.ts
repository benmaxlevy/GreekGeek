import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_SECRET: z.string().min(16),
  WEB_ORIGIN: z.string().url(),
  REDIS_URL: z.string().url(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  /** Pin Stripe Accounts v2 preview (e.g. 2026-07-29.preview). Bump with care. */
  STRIPE_API_VERSION: z.string().min(1),
  APP_URL: z.string().url(),
  /** Rally platform fee as percent of ticket price (default 10). */
  RALLY_FEE_PERCENT: z.coerce.number().nonnegative().default(10),
  /** Max non-void tickets one user may hold per event (default 2). */
  MAX_TICKETS_PER_USER_PER_EVENT: z.coerce.number().int().positive().default(2),
  /** Minutes before open requires_payment purchase expires (default 5). */
  PURCHASE_TTL_MINUTES: z.coerce.number().int().positive().default(5),
  /** Days after event end/start before automatic payout release (default 5). */
  PAYOUT_HOLD_DAYS: z.coerce.number().int().nonnegative().default(5),
});

export type Env = z.infer<typeof envSchema>;
