import type { PublicUser } from '@rally/contracts';

const MANAGE_PERMISSIONS_KEY = 'members.manage_permissions';
const EVENTS_CREATE_KEY = 'events.create';
const EVENTS_MANAGE_KEY = 'events.manage';

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

/** ACTIVE member who can list/view events (create or manage). */
export function canAccessOrgEvents(user: PublicUser): boolean {
  return (
    user.status === 'ACTIVE' &&
    user.membership != null &&
    (user.permissions.includes(EVENTS_CREATE_KEY) ||
      user.permissions.includes(EVENTS_MANAGE_KEY))
  );
}

export function canCreateOrgEvents(user: PublicUser): boolean {
  return (
    user.status === 'ACTIVE' &&
    user.membership != null &&
    user.permissions.includes(EVENTS_CREATE_KEY)
  );
}

export function canManageOrgEvents(user: PublicUser): boolean {
  return (
    user.status === 'ACTIVE' &&
    user.membership != null &&
    user.permissions.includes(EVENTS_MANAGE_KEY)
  );
}

export function canCreateEvents(user: PublicUser): boolean {
  return (
    user.status === 'ACTIVE' &&
    user.membership != null &&
    user.permissions.includes('events.create')
  );
}

export function canManageEvents(user: PublicUser): boolean {
  return (
    user.status === 'ACTIVE' &&
    user.membership != null &&
    user.permissions.includes('events.manage')
  );
}

/** List/view events UI: create or manage in own org. */
export function canAccessEvents(user: PublicUser): boolean {
  return canCreateEvents(user) || canManageEvents(user);
}

/** ACTIVE member with tickets.manage in their org. */
export function canManageTickets(user: PublicUser): boolean {
  return (
    user.status === 'ACTIVE' &&
    user.membership != null &&
    user.permissions.includes('tickets.manage')
  );
}

/** ACTIVE member with payments.manage in their org (or platform ADMIN). */
export function canManagePayments(user: PublicUser): boolean {
  if (user.status !== 'ACTIVE') {
    return false;
  }
  if (user.role === 'ADMIN') {
    return true;
  }
  return (
    user.membership != null && user.permissions.includes('payments.manage')
  );
}

/** payments.manage on a specific org (ADMIN bypasses org match). */
export function canManageOrgPayments(
  user: PublicUser,
  organizationId: string,
): boolean {
  if (user.status !== 'ACTIVE') {
    return false;
  }
  if (user.role === 'ADMIN') {
    return true;
  }
  return (
    user.membership?.organizationId === organizationId &&
    user.permissions.includes('payments.manage')
  );
}

/** ACTIVE host-org member with tickets.scan (door staff). Not implied by tickets.manage. */
export function canScanTickets(user: PublicUser): boolean {
  return (
    user.status === 'ACTIVE' &&
    user.membership != null &&
    user.permissions.includes('tickets.scan')
  );
}

/** Event ticketing page: manage allocations/tickets or host-org scan. */
export function canAccessEventTicketing(user: PublicUser): boolean {
  return canManageTickets(user) || canScanTickets(user) || isAdminUser(user);
}
