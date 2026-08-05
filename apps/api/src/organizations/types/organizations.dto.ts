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
} from '@greekgeek/contracts';

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
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeTransfersEnabled: boolean;
  stripeDetailsSubmitted: boolean;
  stripeRequirementsDue: unknown;
  stripeAccountUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Organization {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    universityId: row.universityId,
    stripeAccountId: row.stripeAccountId,
    stripeChargesEnabled: row.stripeChargesEnabled,
    stripePayoutsEnabled: row.stripePayoutsEnabled,
    stripeTransfersEnabled: row.stripeTransfersEnabled,
    stripeDetailsSubmitted: row.stripeDetailsSubmitted,
    stripeRequirementsDue: row.stripeRequirementsDue ?? null,
    stripeAccountUpdatedAt: row.stripeAccountUpdatedAt
      ? row.stripeAccountUpdatedAt.toISOString()
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
