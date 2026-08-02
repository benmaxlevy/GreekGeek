import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_SECRET: z.string().min(16),
  WEB_ORIGIN: z.string().url(),
  REDIS_URL: z.string().url(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;
