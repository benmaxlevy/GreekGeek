## MODIFIED Requirements

### Requirement: Admin manages user approval with approve-or-deny workflow

The admin dashboard MUST provide a user management view at `/admin/users` listing users with status and filtering by status. For `PENDING` users, the UI MUST display requested university and organization (from `requestedOrganizationId`). For `ACTIVE` users without a membership, the UI MUST clearly indicate no organization or membership (e.g. show "None" or equivalent in the membership or organization column). ADMIN MUST be able to **approve** (confirm or override organization membership and activate) or **deny** (set `INACTIVE`). Permission grants MUST NOT be part of the approval flow. ADMIN MUST be able to reactivate `INACTIVE` users to `ACTIVE`. Officer pending-approval flows MUST NOT live under `/admin/*`; delegated approve/deny for officers belongs on the `/users` route for members with `members.manage_permissions`.

#### Scenario: Admin views pending users with requested org

- **WHEN** a platform ADMIN opens the admin user management page at `/admin/users`
- **THEN** users are listed with status, and PENDING users show their requested university and organization

#### Scenario: Admin views active users without membership

- **WHEN** a platform ADMIN opens the admin user management page at `/admin/users` and an ACTIVE user has no membership row
- **THEN** the user's membership or organization column clearly shows no organization (e.g. "None") rather than an empty or ambiguous value

#### Scenario: Admin approves and activates pending user from UI

- **WHEN** a platform ADMIN confirms or overrides the organization for a PENDING user and activates them through the admin dashboard
- **THEN** the user's status becomes ACTIVE, membership is created for the confirmed or override organization with zero permissions, and the list reflects the change

#### Scenario: Admin denies pending user from UI

- **WHEN** a platform ADMIN rejects a PENDING user by setting status INACTIVE through the admin dashboard
- **THEN** the user's status becomes INACTIVE and the list reflects the change

#### Scenario: Admin reactivates inactive user from UI

- **WHEN** a platform ADMIN sets an INACTIVE user's status to ACTIVE through the admin dashboard
- **THEN** the user's status becomes ACTIVE and the list reflects the change

#### Scenario: Non-admin cannot access admin user management

- **WHEN** a non-ADMIN user navigates to `/admin/users`
- **THEN** the app redirects away from admin routes without exposing admin user controls
