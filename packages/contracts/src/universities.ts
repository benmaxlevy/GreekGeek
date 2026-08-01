import { z } from 'zod';

export const UniversitySchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type University = z.infer<typeof UniversitySchema>;

export const CreateUniversitySchema = z.object({
  name: z.string().min(1).max(200),
});
export type CreateUniversity = z.infer<typeof CreateUniversitySchema>;

export const UpdateUniversitySchema = z.object({
  name: z.string().min(1).max(200),
});
export type UpdateUniversity = z.infer<typeof UpdateUniversitySchema>;

export const UniversityListSchema = z.array(UniversitySchema);
export type UniversityList = z.infer<typeof UniversityListSchema>;
