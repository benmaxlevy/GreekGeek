import { SetMetadata } from '@nestjs/common';

export const ORG_PERMISSION_KEY = 'orgPermission';

export type OrgPermissionMeta = {
  permissionKey: string;
  /** Route param holding membership id; org resolved from membership. */
  membershipParam?: string;
  /** Route param or body field holding organization id. */
  organizationIdParam?: string;
};

export const RequireOrgPermission = (
  permissionKey: string,
  options?: Omit<OrgPermissionMeta, 'permissionKey'>,
) =>
  SetMetadata(ORG_PERMISSION_KEY, {
    permissionKey,
    ...options,
  } satisfies OrgPermissionMeta);
