import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  grantMemberPermission,
  listAdminUsers,
  listMemberPermissions,
  listMemberships,
  listOrganizations,
  listPermissions,
  revokeMemberPermission,
} from '@/lib/admin-api';

export const Route = createFileRoute('/admin/permissions')({
  component: AdminPermissionsPage,
});

function AdminPermissionsPage() {
  const queryClient = useQueryClient();
  const [membershipId, setMembershipId] = useState('');
  const [permissionKey, setPermissionKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ['admin', 'permissions', 'catalog'],
    queryFn: listPermissions,
  });

  const membershipsQuery = useQuery({
    queryKey: ['admin', 'memberships'],
    queryFn: listMemberships,
  });

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', 'ACTIVE'],
    queryFn: () => listAdminUsers({ status: 'ACTIVE' }),
  });

  const organizationsQuery = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: () => listOrganizations(),
  });

  const activeUserIds = useMemo(
    () => new Set((usersQuery.data ?? []).map((u) => u.id)),
    [usersQuery.data],
  );

  const membershipOptions = useMemo(() => {
    const users = new Map((usersQuery.data ?? []).map((u) => [u.id, u]));
    const orgs = new Map((organizationsQuery.data ?? []).map((o) => [o.id, o]));
    return (membershipsQuery.data ?? [])
      .filter((m) => activeUserIds.has(m.userId))
      .map((m) => {
        const user = users.get(m.userId);
        const org = orgs.get(m.organizationId);
        return {
          id: m.id,
          label: `${user?.name ?? m.userId} · ${org?.name ?? m.organizationId}`,
        };
      });
  }, [membershipsQuery.data, usersQuery.data, organizationsQuery.data, activeUserIds]);

  useEffect(() => {
    if (membershipId && !membershipOptions.some((m) => m.id === membershipId)) {
      setMembershipId('');
    }
  }, [membershipId, membershipOptions]);

  const grantsQuery = useQuery({
    queryKey: ['admin', 'member-permissions', membershipId],
    queryFn: () => listMemberPermissions(membershipId),
    enabled: Boolean(membershipId),
  });

  const grantMutation = useMutation({
    mutationFn: () => grantMemberPermission(membershipId, { permissionKey }),
    onSuccess: async () => {
      setPermissionKey('');
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'member-permissions', membershipId],
      });
    },
    onError: (err: Error) => setError(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (permissionKey: string) =>
      revokeMemberPermission(membershipId, permissionKey),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'member-permissions', membershipId],
      });
    },
    onError: (err: Error) => setError(err.message),
  });

  const grantedKeys = new Set((grantsQuery.data ?? []).map((g) => g.permissionKey));
  const catalog = [...(catalogQuery.data ?? [])].sort((a, b) =>
    a.key.localeCompare(b.key),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight">Permissions</h1>
        <p className="mt-1 text-sm text-ink-500">
          See available permissions and grant them to active members.
        </p>
      </div>

      {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available permissions</CardTitle>
        </CardHeader>
        <CardContent>
          {catalogQuery.isLoading ? (
            <p className="text-sm text-ink-500">Loading permissions…</p>
          ) : catalog.length === 0 ? (
            <p className="text-sm text-ink-500">No permissions available.</p>
          ) : (
            <ul className="space-y-3">
              {catalog.map((p) => (
                <li key={p.id} className="space-y-1">
                  <Badge variant="secondary">{p.key}</Badge>
                  <p className="text-sm text-ink-500">{p.description}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Grants for membership</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="perm-membership">ACTIVE membership</Label>
            <select
              id="perm-membership"
              value={membershipId}
              onChange={(e) => {
                setMembershipId(e.target.value);
                setError(null);
              }}
              className="min-h-11 w-full rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100"
            >
              <option value="">Select membership…</option>
              {membershipOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {membershipId ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="perm-key">Grant permission</Label>
                  <select
                    id="perm-key"
                    value={permissionKey}
                    onChange={(e) => setPermissionKey(e.target.value)}
                    className="min-h-11 w-full rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100"
                  >
                    <option value="">Select key…</option>
                    {catalog
                      .filter((p) => !grantedKeys.has(p.key))
                      .map((p) => (
                        <option key={p.id} value={p.key}>
                          {p.key}
                        </option>
                      ))}
                  </select>
                </div>
                <Button
                  type="button"
                  disabled={!permissionKey}
                  isLoading={grantMutation.isPending}
                  onClick={() => grantMutation.mutate()}
                >
                  Grant
                </Button>
              </div>

              {grantsQuery.isLoading ? (
                <p className="text-sm text-ink-500">Loading grants…</p>
              ) : (grantsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-ink-500">No grants on this membership.</p>
              ) : (
                <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle">
                  {(grantsQuery.data ?? []).map((g) => (
                    <li
                      key={g.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <Badge>{g.permissionKey}</Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate(g.permissionKey)}
                      >
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
