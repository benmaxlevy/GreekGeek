import {
  AdminUserListSchema,
  AdminUserSchema,
  CreateOrganizationSchema,
  CreateUniversitySchema,
  GrantPermissionSchema,
  MemberPermissionSchema,
  MemberPermissionListSchema,
  MembershipListSchema,
  MembershipSchema,
  OrganizationListSchema,
  OrganizationSchema,
  PermissionListSchema,
  UniversityListSchema,
  UniversitySchema,
  UpdateOrganizationSchema,
  UpdateUniversitySchema,
  PatchUserStatusSchema,
  type AdminUser,
  type AdminUserList,
  AssignMembershipSchema,
  type AssignMembership,
  type CreateOrganization,
  type CreateUniversity,
  type GrantPermission,
  type ListOrganizationsQuery,
  type ListUsersQuery,
  type MemberPermission,
  type MemberPermissionList,
  type Membership,
  type MembershipList,
  type Organization,
  type OrganizationList,
  type PatchUserStatus,
  type PermissionList,
  type University,
  type UniversityList,
  type UpdateOrganization,
  type UpdateUniversity,
} from '@rally/contracts';
import { apiFetch, readError } from './api';

function toQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, value);
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function listAdminUsers(query: ListUsersQuery = {}): Promise<AdminUserList> {
  const res = await apiFetch(`/api/admin/users${toQuery({ status: query.status })}`);
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to list users'));
  }
  return AdminUserListSchema.parse(await res.json());
}

export async function patchUserStatus(id: string, body: PatchUserStatus): Promise<AdminUser> {
  const payload = PatchUserStatusSchema.parse(body);
  const res = await apiFetch(`/api/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to update user status'));
  }
  return AdminUserSchema.parse(await res.json());
}

export async function fillActivateUser(id: string, organizationId: string): Promise<AdminUser> {
  return patchUserStatus(id, { status: 'ACTIVE', organizationId });
}

export async function killUser(id: string): Promise<AdminUser> {
  return patchUserStatus(id, { status: 'INACTIVE' });
}

/** ACTIVE → INACTIVE (admin deactivate). Same payload as kill. */
export async function deactivateUser(id: string): Promise<AdminUser> {
  return patchUserStatus(id, { status: 'INACTIVE' });
}

/** INACTIVE → ACTIVE status-only. Must not send organizationId. */
export async function reactivateUser(id: string): Promise<AdminUser> {
  return patchUserStatus(id, { status: 'ACTIVE' });
}

export async function listUniversities(): Promise<UniversityList> {
  const res = await apiFetch('/api/universities');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to list universities'));
  }
  return UniversityListSchema.parse(await res.json());
}

export async function createUniversity(body: CreateUniversity): Promise<University> {
  CreateUniversitySchema.parse(body);
  const res = await apiFetch('/api/universities', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to create university'));
  }
  return UniversitySchema.parse(await res.json());
}

export async function updateUniversity(id: string, body: UpdateUniversity): Promise<University> {
  UpdateUniversitySchema.parse(body);
  const res = await apiFetch(`/api/universities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to update university'));
  }
  return UniversitySchema.parse(await res.json());
}

export async function deleteUniversity(id: string): Promise<void> {
  const res = await apiFetch(`/api/universities/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const message = await readError(res, 'Failed to delete university');
    throw new Error(res.status === 409 ? `Conflict (409): ${message}` : message);
  }
}

export async function listOrganizations(
  query: ListOrganizationsQuery = {},
): Promise<OrganizationList> {
  const res = await apiFetch(
    `/api/organizations${toQuery({ universityId: query.universityId })}`,
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to list organizations'));
  }
  return OrganizationListSchema.parse(await res.json());
}

export async function createOrganization(body: CreateOrganization): Promise<Organization> {
  CreateOrganizationSchema.parse(body);
  const res = await apiFetch('/api/organizations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to create organization'));
  }
  return OrganizationSchema.parse(await res.json());
}

export async function updateOrganization(
  id: string,
  body: UpdateOrganization,
): Promise<Organization> {
  UpdateOrganizationSchema.parse(body);
  const res = await apiFetch(`/api/organizations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to update organization'));
  }
  return OrganizationSchema.parse(await res.json());
}

export async function deleteOrganization(id: string): Promise<void> {
  const res = await apiFetch(`/api/organizations/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const message = await readError(res, 'Failed to delete organization');
    throw new Error(res.status === 409 ? `Conflict (409): ${message}` : message);
  }
}

export async function listMemberships(): Promise<MembershipList> {
  const res = await apiFetch('/api/memberships');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to list memberships'));
  }
  return MembershipListSchema.parse(await res.json());
}

export async function assignMembership(body: AssignMembership): Promise<Membership> {
  const payload = AssignMembershipSchema.parse(body);
  const res = await apiFetch('/api/memberships', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to assign membership'));
  }
  return MembershipSchema.parse(await res.json());
}

export async function removeMembership(id: string): Promise<void> {
  const res = await apiFetch(`/api/memberships/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to remove membership'));
  }
}

export async function listPermissions(): Promise<PermissionList> {
  const res = await apiFetch('/api/permissions');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to list permissions'));
  }
  return PermissionListSchema.parse(await res.json());
}

export async function listMemberPermissions(
  membershipId: string,
): Promise<MemberPermissionList> {
  const res = await apiFetch(`/api/memberships/${membershipId}/permissions`);
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to list member permissions'));
  }
  return MemberPermissionListSchema.parse(await res.json());
}

export async function grantMemberPermission(
  membershipId: string,
  body: GrantPermission,
): Promise<MemberPermission> {
  GrantPermissionSchema.parse(body);
  const res = await apiFetch(`/api/memberships/${membershipId}/permissions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to grant permission'));
  }
  return MemberPermissionSchema.parse(await res.json());
}

export async function revokeMemberPermission(
  membershipId: string,
  permissionKey: string,
): Promise<void> {
  const res = await apiFetch(
    `/api/memberships/${membershipId}/permissions/${encodeURIComponent(permissionKey)}`,
    {
      method: 'DELETE',
    },
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to revoke permission'));
  }
}
