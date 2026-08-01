import type { PublicUser } from '@rally/contracts';

const MANAGE_PERMISSIONS_KEY = 'members.manage_permissions';

/** Destination after login / session restore based on status. */
export function destinationForUser(user: PublicUser): '/app' | '/awaiting-approval' | '/blocked' {
  if (user.status === 'PENDING') {
    return '/awaiting-approval';
  }
  if (user.status === 'INACTIVE') {
    return '/blocked';
  }
  return '/app';
}

export function isActiveUser(user: PublicUser): boolean {
  return user.status === 'ACTIVE';
}

export function isAdminUser(user: PublicUser): boolean {
  return user.role === 'ADMIN' && user.status === 'ACTIVE';
}

/** ACTIVE member with org permission to manage pending applicants / grants. */
export function canManageOrgPendingApprovals(user: PublicUser): boolean {
  return (
    user.status === 'ACTIVE' &&
    user.membership != null &&
    user.permissions.includes(MANAGE_PERMISSIONS_KEY)
  );
}
