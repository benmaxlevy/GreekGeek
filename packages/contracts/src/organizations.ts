import { z } from 'zod';

export const OrganizationTypeSchema = z.enum(['FRATERNITY', 'SORORITY']);
export type OrganizationType = z.infer<typeof OrganizationTypeSchema>;

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: OrganizationTypeSchema,
  universityId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
  type: OrganizationTypeSchema,
  universityId: z.string().min(1),
});
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: OrganizationTypeSchema.optional(),
}).refine((v) => v.name !== undefined || v.type !== undefined, {
  message: 'At least one of name or type is required',
});
export type UpdateOrganization = z.infer<typeof UpdateOrganizationSchema>;

export const ListOrganizationsQuerySchema = z.object({
  universityId: z.string().min(1).optional(),
});
export type ListOrganizationsQuery = z.infer<typeof ListOrganizationsQuerySchema>;

export const OrganizationListSchema = z.array(OrganizationSchema);
export type OrganizationList = z.infer<typeof OrganizationListSchema>;
