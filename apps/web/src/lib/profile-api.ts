import {
  ProfileSummarySchema,
  PublicUserSchema,
  UpdateDisplayNameRequestSchema,
  type ProfileSummary,
  type PublicUser,
  type UpdateDisplayNameRequest,
} from '@rally/contracts';
import { apiFetch, readError } from './api';

export async function updateDisplayName(body: UpdateDisplayNameRequest): Promise<PublicUser> {
  const payload = UpdateDisplayNameRequestSchema.parse(body);
  const res = await apiFetch('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to update display name'));
  }
  return PublicUserSchema.parse(await res.json());
}

export async function fetchProfileSummary(): Promise<ProfileSummary> {
  const res = await apiFetch('/api/auth/me/summary');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load profile summary'));
  }
  return ProfileSummarySchema.parse(await res.json());
}
