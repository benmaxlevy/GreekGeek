import { useMemo, useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminUser, Organization, University, UserStatus } from '@greekgeek/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  approveUser,
  deactivateUser,
  denyUser,
  listAdminUsers,
  listOrganizations,
  listUniversities,
  reactivateUser,
} from '@/lib/admin-api';

export const Route = createFileRoute('/admin/users')({
  component: AdminUsersPage,
});

const STATUS_FILTERS: Array<UserStatus | 'ALL'> = ['ALL', 'PENDING', 'ACTIVE', 'INACTIVE'];

function statusBadgeVariant(status: UserStatus) {
  if (status === 'ACTIVE') return 'default' as const;
  if (status === 'PENDING') return 'secondary' as const;
  return 'destructive' as const;
}

function orgLabel(
  organizationId: string | null | undefined,
  orgs: Map<string, Organization>,
  unis: Map<string, University>,
): string | null {
  if (!organizationId) return null;
  const org = orgs.get(organizationId);
  if (!org) return organizationId;
  const uni = unis.get(org.universityId);
  return `${uni?.name ?? 'University'} · ${org.name} (${org.type})`;
}

function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'ALL'>('PENDING');
  const [approveUserId, setApproveUserId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', statusFilter],
    queryFn: () => listAdminUsers(statusFilter === 'ALL' ? {} : { status: statusFilter }),
  });

  const universitiesQuery = useQuery({
    queryKey: ['admin', 'universities'],
    queryFn: listUniversities,
  });

  const organizationsQuery = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: () => listOrganizations(),
  });

  const orgById = useMemo(() => {
    const map = new Map<string, Organization>();
    for (const org of organizationsQuery.data ?? []) {
      map.set(org.id, org);
    }
    return map;
  }, [organizationsQuery.data]);

  const uniById = useMemo(() => {
    const map = new Map<string, University>();
    for (const uni of universitiesQuery.data ?? []) {
      map.set(uni.id, uni);
    }
    return map;
  }, [universitiesQuery.data]);

  const orgsByUniversity = useMemo(() => {
    const map = new Map<string, Organization[]>();
    for (const org of organizationsQuery.data ?? []) {
      const list = map.get(org.universityId) ?? [];
      list.push(org);
      map.set(org.universityId, list);
    }
    return map;
  }, [organizationsQuery.data]);

  const selectedApproveUser = useMemo(
    () => (usersQuery.data ?? []).find((u) => u.id === approveUserId) ?? null,
    [usersQuery.data, approveUserId],
  );

  const requestedLabel = orgLabel(selectedApproveUser?.requestedOrganizationId, orgById, uniById);

  function invalidateUsers() {
    return queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  }

  const approveMutation = useMutation({
    mutationFn: ({ userId, orgId }: { userId: string; orgId: string }) =>
      approveUser(userId, orgId),
    onSuccess: async () => {
      setApproveUserId(null);
      setOrganizationId('');
      setError(null);
      await invalidateUsers();
    },
    onError: (err: Error) => setError(err.message),
  });

  const denyMutation = useMutation({
    mutationFn: (userId: string) => denyUser(userId),
    onSuccess: async () => {
      setError(null);
      await invalidateUsers();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => deactivateUser(userId),
    onSuccess: async () => {
      setError(null);
      await invalidateUsers();
    },
    onError: (err: Error) => setError(err.message),
  });

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) => reactivateUser(userId),
    onSuccess: async () => {
      setError(null);
      await invalidateUsers();
    },
    onError: (err: Error) => setError(err.message),
  });

  function onApproveSubmit(event: FormEvent) {
    event.preventDefault();
    if (!approveUserId || !organizationId) {
      setError('Organization required to approve and activate');
      return;
    }
    approveMutation.mutate({ userId: approveUserId, orgId: organizationId });
  }

  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="rl-eyebrow">Admin / directory</p>
        <h1 className="display-sm">Users</h1>
        <p className="max-w-2xl text-sm leading-6 text-ink-500">
          Approve or deny applicants, and manage user accounts.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((status) => (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={statusFilter === status ? 'default' : 'outline'}
            onClick={() => setStatusFilter(status)}
          >
            {status}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-[color:var(--error)]/30 bg-[color:var(--error)]/10 px-4 py-3 text-sm text-[color:var(--error)]">
          {error}
        </p>
      ) : null}

      {approveUserId && selectedApproveUser ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <p className="rl-eyebrow">Review request</p>
            <CardTitle className="display-sm">Approve &amp; activate</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={onApproveSubmit}>
              <div className="space-y-1 text-sm">
                <p className="text-ink-100">{selectedApproveUser.name}</p>
                <p className="text-ink-500">{selectedApproveUser.email}</p>
                <p className="text-ink-300">
                  Requested:{' '}
                  {requestedLabel ?? <span className="text-ink-500">none on record</span>}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="organizationId">Organization (confirm or override)</Label>
                <select
                  id="organizationId"
                  required
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="min-h-11 w-full rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100"
                >
                  <option value="">Select organization…</option>
                  {(universitiesQuery.data ?? []).map((uni) => (
                    <optgroup key={uni.id} label={uni.name}>
                      {(orgsByUniversity.get(uni.id) ?? []).map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.type})
                          {org.id === selectedApproveUser.requestedOrganizationId
                            ? ' — requested'
                            : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" isLoading={approveMutation.isPending}>
                  Activate with org
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setApproveUserId(null);
                    setOrganizationId('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {usersQuery.isLoading ? (
            <p className="p-6 text-sm text-ink-500">Loading users…</p>
          ) : users.length === 0 ? (
            <p className="p-6 text-sm text-ink-500">No users for this filter.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  requestedLabel={orgLabel(user.requestedOrganizationId, orgById, uniById)}
                  busy={
                    denyMutation.isPending ||
                    deactivateMutation.isPending ||
                    reactivateMutation.isPending ||
                    approveMutation.isPending
                  }
                  onApprove={() => {
                    setError(null);
                    setApproveUserId(user.id);
                    setOrganizationId(user.requestedOrganizationId ?? '');
                  }}
                  onDeny={() => denyMutation.mutate(user.id)}
                  onDeactivate={() => deactivateMutation.mutate(user.id)}
                  onReactivate={() => reactivateMutation.mutate(user.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {(organizationsQuery.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-ink-500">
          No organizations yet — create one under Organizations before approving pending users.
        </p>
      ) : null}
    </div>
  );
}

function UserRow({
  user,
  requestedLabel,
  busy,
  onApprove,
  onDeny,
  onDeactivate,
  onReactivate,
}: {
  user: AdminUser;
  requestedLabel: string | null;
  busy: boolean;
  onApprove: () => void;
  onDeny: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  return (
    <li className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-ink-100">{user.name}</p>
          <Badge variant={statusBadgeVariant(user.status)}>{user.status}</Badge>
          <Badge variant="outline">{user.role}</Badge>
        </div>
        <p className="truncate text-sm text-ink-500">{user.email}</p>
        {user.status === 'PENDING' ? (
          <p className="truncate text-sm text-ink-300">Requested: {requestedLabel ?? '—'}</p>
        ) : null}
        {user.status === 'ACTIVE' ? (
          <p className="truncate text-sm text-ink-300">
            Membership:{' '}
            {user.membership
              ? (user.membership.organizationName ?? user.membership.organizationId)
              : 'None'}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {user.status === 'PENDING' ? (
          <>
            <Button type="button" size="sm" disabled={busy} onClick={onApprove}>
              Approve
            </Button>
            <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onDeny}>
              Deny
            </Button>
          </>
        ) : null}
        {user.status === 'ACTIVE' && user.role !== 'ADMIN' ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={onDeactivate}
          >
            Deactivate
          </Button>
        ) : null}
        {user.status === 'INACTIVE' ? (
          <Button type="button" size="sm" disabled={busy} onClick={onReactivate}>
            Reactivate
          </Button>
        ) : null}
      </div>
    </li>
  );
}
