import { useMemo, useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  assignMembership,
  listAdminUsers,
  listMemberships,
  listOrganizations,
  listUniversities,
  removeMembership,
} from '@/lib/admin-api';

export const Route = createFileRoute('/admin/memberships')({
  component: AdminMembershipsPage,
});

function AdminMembershipsPage() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const membershipsQuery = useQuery({
    queryKey: ['admin', 'memberships'],
    queryFn: listMemberships,
  });

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', 'ALL'],
    queryFn: () => listAdminUsers(),
  });

  const activeUsersQuery = useQuery({
    queryKey: ['admin', 'users', 'ACTIVE'],
    queryFn: () => listAdminUsers({ status: 'ACTIVE' }),
  });

  const organizationsQuery = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: () => listOrganizations(),
  });

  const universitiesQuery = useQuery({
    queryKey: ['admin', 'universities'],
    queryFn: listUniversities,
  });

  const memberUserIds = useMemo(
    () => new Set((membershipsQuery.data ?? []).map((m) => m.userId)),
    [membershipsQuery.data],
  );

  const assignableUsers = useMemo(
    () =>
      (activeUsersQuery.data ?? []).filter(
        (u) => u.role === 'USER' && !memberUserIds.has(u.id),
      ),
    [activeUsersQuery.data, memberUserIds],
  );

  const userName = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of usersQuery.data ?? []) {
      map.set(u.id, `${u.name} (${u.email})`);
    }
    return map;
  }, [usersQuery.data]);

  const orgLabel = useMemo(() => {
    const uni = new Map((universitiesQuery.data ?? []).map((u) => [u.id, u.name]));
    const map = new Map<string, string>();
    for (const org of organizationsQuery.data ?? []) {
      map.set(org.id, `${org.name} · ${uni.get(org.universityId) ?? '—'}`);
    }
    return map;
  }, [organizationsQuery.data, universitiesQuery.data]);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['admin', 'memberships'] });
  }

  const assignMutation = useMutation({
    mutationFn: () => assignMembership({ userId, organizationId }),
    onSuccess: async () => {
      setUserId('');
      setOrganizationId('');
      setError(null);
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeMembership(id),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const memberships = membershipsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight">Memberships</h1>
        <p className="mt-1 text-sm text-ink-500">
          Assign ACTIVE users to an organization (one membership per user). Admins cannot hold
          membership.
        </p>
      </div>

      {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assign membership</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              assignMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="member-user">User</Label>
              <select
                id="member-user"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="min-h-11 w-full rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100"
              >
                <option value="">Select ACTIVE user…</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-org">Organization</Label>
              <select
                id="member-org"
                required
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="min-h-11 w-full rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100"
              >
                <option value="">Select organization…</option>
                {(organizationsQuery.data ?? []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {orgLabel.get(org.id) ?? org.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" isLoading={assignMutation.isPending}>
                Assign
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {membershipsQuery.isLoading ? (
            <p className="p-6 text-sm text-ink-500">Loading…</p>
          ) : memberships.length === 0 ? (
            <p className="p-6 text-sm text-ink-500">No memberships yet.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {memberships.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-ink-100">
                      {userName.get(m.userId) ?? m.userId}
                    </p>
                    <p className="text-ink-500">{orgLabel.get(m.organizationId) ?? m.organizationId}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(m.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
