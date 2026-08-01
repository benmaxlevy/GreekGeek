import {
  CreateUniversitySchema,
  UniversityListSchema,
  UniversitySchema,
  UpdateUniversitySchema,
  type CreateUniversity,
  type University,
  type UniversityList,
  type UpdateUniversity,
} from '@rally/contracts';

export {
  CreateUniversitySchema,
  UniversityListSchema,
  UniversitySchema,
  UpdateUniversitySchema,
};

export type { CreateUniversity, University, UniversityList, UpdateUniversity };

export function toUniversityDto(row: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): University {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
