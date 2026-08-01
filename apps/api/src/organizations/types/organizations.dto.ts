import {
  CreateOrganizationSchema,
  ListOrganizationsQuerySchema,
  OrganizationListSchema,
  OrganizationSchema,
  OrganizationTypeSchema,
  UpdateOrganizationSchema,
  type CreateOrganization,
  type ListOrganizationsQuery,
  type Organization,
  type OrganizationList,
  type UpdateOrganization,
} from '@rally/contracts';

export {
  CreateOrganizationSchema,
  ListOrganizationsQuerySchema,
  OrganizationListSchema,
  OrganizationSchema,
  OrganizationTypeSchema,
  UpdateOrganizationSchema,
};

export type {
  CreateOrganization,
  ListOrganizationsQuery,
  Organization,
  OrganizationList,
  UpdateOrganization,
};

export function toOrganizationDto(row: {
  id: string;
  name: string;
  type: Organization['type'];
  universityId: string;
  createdAt: Date;
  updatedAt: Date;
}): Organization {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    universityId: row.universityId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
