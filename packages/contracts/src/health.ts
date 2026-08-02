import { z } from 'zod';

export const HealthStatusSchema = z.enum(['ok', 'degraded']);

export const HealthResponseSchema = z.object({
  status: HealthStatusSchema,
  database: z.enum(['up', 'down']),
  redis: z.enum(['up', 'down']),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
