import { z } from 'zod';

export const EnqueueProveJobSchema = z.object({
  message: z.string().min(1),
});

export type EnqueueProveJob = z.infer<typeof EnqueueProveJobSchema>;

export const EnqueueProveJobResponseSchema = z.object({
  jobId: z.string(),
});

export type EnqueueProveJobResponse = z.infer<
  typeof EnqueueProveJobResponseSchema
>;
