import { useMemo, useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminUser, Organization, UserStatus } from '@rally/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  deactivateUser,
  fillActivateUser,
  killUser,
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

function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'ALL'>('PENDING');
  const [fillUserId, setFillUserId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', statusFilter],
    queryFn: () =>
      listAdminUsers(statusFilter === 'ALL' ? {} : { status: statusFilter }),
  });

  const universitiesQuery = useQuery({
    queryKey: ['admin', 'universities'],
    queryFn: listUniversities,
  });

  const organizationsQuery = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: () => listOrganizations(),
  });

  const orgsByUniversity = useMemo(() => {
    const map = new Map<string, Organization[]>();
    for (const org of organizationsQuery.data ?? []) {
      const list = map.get(org.universityId) ?? [];
      list.push(org);
      map.set(org.universityId, list);
    }
    return map;
  }, [organizationsQuery.data]);

  function invalidateUsers() {
    return queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  }

  const fillMutation = useMutation({
    mutationFn: ({ userId, orgId }: { userId: string; orgId: string }) =>
      fillActivateUser(userId, orgId),
    onSuccess: async () => {
      setFillUserId(null);
      setOrganizationId('');
      setError(null);
      await invalidateUsers();
    },
    onError: (err: Error) => setError(err.message),
  });

  const killMutation = useMutation({
    mutationFn: (userId: string) => killUser(userId),
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

  function onFillSubmit(event: FormEvent) {
    event.preventDefault();
    if (!fillUserId || !organizationId) {
      setError('Organization required to fill and activate');
      return;
    }
    fillMutation.mutate({ userId: fillUserId, orgId: organizationId });
  }

  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-ink-500">
          Fill pending (org required) or kill; deactivate ACTIVE users; reactivate INACTIVE
          without org. Permissions only after ACTIVE.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
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

      {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}

      {fillUserId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fill &amp; activate</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={onFillSubmit}>
              <div className="space-y-2">
                <Label htmlFor="organizationId">Organization</Label>
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
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" isLoading={fillMutation.isPending}>
                  Activate with org
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFillUserId(null);
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

      <Card>
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
                  busy={
                    killMutation.isPending ||
                    deactivateMutation.isPending ||
                    reactivateMutation.isPending ||
                    fillMutation.isPending
                  }
                  onFill={() => {
                    setError(null);
                    setFillUserId(user.id);
                    setOrganizationId('');
                  }}
                  onKill={() => killMutation.mutate(user.id)}
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
          No organizations yet — create one under Organizations before filling pending users.
          {universitiesQuery.data?.length
            ? ` Universities: ${universitiesQuery.data.map((u) => u.name).join(', ')}.`
            : null}
        </p>
      ) : null}
    </div>
  );
}

function UserRow({
  user,
  busy,
  onFill,
  onKill,
  onDeactivate,
  onReactivate,
}: {
  user: AdminUser;
  busy: boolean;
  onFill: () => void;
  onKill: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-ink-100">{user.name}</p>
          <Badge variant={statusBadgeVariant(user.status)}>{user.status}</Badge>
          <Badge variant="outline">{user.role}</Badge>
        </div>
        <p className="truncate text-sm text-ink-500">{user.email}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {user.status === 'PENDING' ? (
          <>
            <Button type="button" size="sm" disabled={busy} onClick={onFill}>
              Fill
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={onKill}
            >
              Kill
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
