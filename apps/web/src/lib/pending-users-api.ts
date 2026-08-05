import {
  PendingApplicantListSchema,
  PendingApplicantSchema,
  PatchPendingApplicantStatusSchema,
  type PendingApplicant,
  type PendingApplicantList,
} from '@greekgeek/contracts';
import { apiFetch, readError } from './api';

export async function listPendingApplicants(
  organizationId: string,
): Promise<PendingApplicantList> {
  const res = await apiFetch(
    `/api/organizations/${organizationId}/pending-users`,
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to list pending applicants'));
  }
  return PendingApplicantListSchema.parse(await res.json());
}

export async function approvePendingApplicant(
  organizationId: string,
  userId: string,
): Promise<PendingApplicant> {
  const body = PatchPendingApplicantStatusSchema.parse({ status: 'ACTIVE' });
  const res = await apiFetch(
    `/api/organizations/${organizationId}/pending-users/${userId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to approve applicant'));
  }
  return PendingApplicantSchema.parse(await res.json());
}

export async function denyPendingApplicant(
  organizationId: string,
  userId: string,
): Promise<PendingApplicant> {
  const body = PatchPendingApplicantStatusSchema.parse({ status: 'INACTIVE' });
  const res = await apiFetch(
    `/api/organizations/${organizationId}/pending-users/${userId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to deny applicant'));
  }
  return PendingApplicantSchema.parse(await res.json());
}
