import { z } from 'zod';
import { PublicUserSchema } from './auth';

/** Pending applicant row for org-scoped approval queue. */
export const PendingApplicantSchema = PublicUserSchema;
export type PendingApplicant = z.infer<typeof PendingApplicantSchema>;

export const PendingApplicantListSchema = z.array(PendingApplicantSchema);
export type PendingApplicantList = z.infer<typeof PendingApplicantListSchema>;

/** Optional pagination later; empty for v1. */
export const ListPendingApplicantsQuerySchema = z.object({}).strict();
export type ListPendingApplicantsQuery = z.infer<
  typeof ListPendingApplicantsQuerySchema
>;

export const OrgPendingUsersParamsSchema = z.object({
  organizationId: z.string().min(1),
});
export type OrgPendingUsersParams = z.infer<typeof OrgPendingUsersParamsSchema>;

export const OrgPendingUserParamsSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1),
});
export type OrgPendingUserParams = z.infer<typeof OrgPendingUserParamsSchema>;

/**
 * Patch pending applicant status (approve ACTIVE / deny INACTIVE).
 * `organizationId` is ADMIN-only override on approve; officers must omit it.
 * Enforce ADMIN-only in service (schema allows optional for shared contract).
 */
export const PatchPendingApplicantStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
  organizationId: z.string().min(1).optional(),
});
export type PatchPendingApplicantStatus = z.infer<
  typeof PatchPendingApplicantStatusSchema
>;
