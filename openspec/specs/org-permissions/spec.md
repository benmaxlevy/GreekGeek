# org-permissions Specification

## Purpose

Provides a seeded catalog of permission keys and direct grants to memberships, enabling org-scoped authorization without role indirection. Platform ADMIN bypasses all org permission checks.

## Requirements

### Requirement: Permission catalog is seeded and listable

The system MUST persist a permission catalog with string id, unique key, description, and timestamps. At minimum the seed MUST include keys `members.manage_permissions`, `events.create`, and `events.manage`. The catalog MUST be listable via API for admin operations. Catalog CRUD beyond seed is out of scope this phase.

#### Scenario: Seed populates permission catalog

- **WHEN** the development seed runs
- **THEN** permission rows exist for at least `members.manage_permissions`, `events.create`, and `events.manage`

#### Scenario: Admin lists permission catalog

- **WHEN** a platform ADMIN requests the permission catalog
- **THEN** the system returns all seeded permissions

### Requirement: Member permissions are direct grants with zero default

The system MUST persist member permissions as join rows linking membershipId and permissionId with a composite unique constraint. Assigning membership MUST NOT auto-grant any permission.

#### Scenario: New membership has no permissions

- **WHEN** a user is assigned to an organization
- **THEN** the membership has zero MemberPermission rows until explicitly granted

### Requirement: Authorized actors grant and revoke member permissions

Permission grant and revoke MUST be allowed for platform ADMIN on any membership belonging to an `ACTIVE` user, or for a member who holds `members.manage_permissions` in the same organization as the target membership. Grants MUST NOT be allowed for memberships of non-`ACTIVE` users. All other callers MUST receive 403. Request shapes MUST be validated with shared Zod schemas.

#### Scenario: Admin grants permission to member

- **WHEN** a platform ADMIN grants a catalog permission to a membership
- **THEN** a MemberPermission row is created and subsequent org-scoped checks for that key succeed for that member

#### Scenario: Admin revokes permission from member

- **WHEN** a platform ADMIN revokes a granted permission from a membership
- **THEN** the MemberPermission row is removed

#### Scenario: Delegated manager grants permission in own org

- **WHEN** a member with `members.manage_permissions` grants a permission to another membership in the same organization
- **THEN** the grant succeeds

#### Scenario: Delegated manager cannot grant outside own org

- **WHEN** a member with `members.manage_permissions` in org A attempts to grant a permission on a membership in org B
- **THEN** the system returns 403 Forbidden

#### Scenario: Member without manage permission cannot grant

- **WHEN** a member without `members.manage_permissions` attempts to grant or revoke any permission
- **THEN** the system returns 403 Forbidden

### Requirement: Org-scoped permission guard with admin bypass

Protected org-scoped endpoints MUST verify the caller holds the required permission key for the target organization, unless the caller is platform ADMIN. ADMIN MUST bypass all org permission checks without holding a membership.

#### Scenario: Admin bypasses org permission check

- **WHEN** a platform ADMIN calls an org-scoped endpoint requiring a permission key they do not hold via membership
- **THEN** the request is allowed

#### Scenario: Member with permission succeeds

- **WHEN** a member with the required permission key for the target org calls the guarded endpoint
- **THEN** the request is allowed

#### Scenario: Member without permission denied

- **WHEN** a member without the required permission key calls the guarded endpoint
- **THEN** the system returns 403 Forbidden

#### Scenario: User without membership denied

- **WHEN** a non-ADMIN user with no membership for the target org calls the guarded endpoint
- **THEN** the system returns 403 Forbidden
