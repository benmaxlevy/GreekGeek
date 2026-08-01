import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Organization, OrganizationType } from '@rally/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createOrganization,
  deleteOrganization,
  listOrganizations,
  listUniversities,
  updateOrganization,
} from '@/lib/admin-api';

export const Route = createFileRoute('/admin/organizations')({
  component: AdminOrganizationsPage,
});

function AdminOrganizationsPage() {
  const queryClient = useQueryClient();
  const [universityFilter, setUniversityFilter] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<OrganizationType>('FRATERNITY');
  const [universityId, setUniversityId] = useState('');
  const [editing, setEditing] = useState<Organization | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<OrganizationType>('FRATERNITY');
  const [error, setError] = useState<string | null>(null);

  const universitiesQuery = useQuery({
    queryKey: ['admin', 'universities'],
    queryFn: listUniversities,
  });

  const listQuery = useQuery({
    queryKey: ['admin', 'organizations', universityFilter],
    queryFn: () =>
      listOrganizations(universityFilter ? { universityId: universityFilter } : {}),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
  }

  const createMutation = useMutation({
    mutationFn: () => createOrganization({ name, type, universityId }),
    onSuccess: async () => {
      setName('');
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('No organization selected');
      return updateOrganization(editing.id, { name: editName, type: editType });
    },
    onSuccess: async () => {
      setEditing(null);
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrganization(id),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const uniName = new Map((universitiesQuery.data ?? []).map((u) => [u.id, u.name]));
  const organizations = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight">Organizations</h1>
        <p className="mt-1 text-sm text-ink-500">
          Chapters bound to a university. Delete fails with conflict when memberships exist.
        </p>
      </div>

      {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}

      <div className="space-y-2">
        <Label htmlFor="org-filter">Filter by university</Label>
        <select
          id="org-filter"
          value={universityFilter}
          onChange={(e) => setUniversityFilter(e.target.value)}
          className="min-h-11 w-full max-w-md rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100"
        >
          <option value="">All universities</option>
          {(universitiesQuery.data ?? []).map((uni) => (
            <option key={uni.id} value={uni.id}>
              {uni.name}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create organization</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-type">Type</Label>
              <select
                id="org-type"
                value={type}
                onChange={(e) => setType(e.target.value as OrganizationType)}
                className="min-h-11 w-full rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100"
              >
                <option value="FRATERNITY">Fraternity</option>
                <option value="SORORITY">Sorority</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-uni">University</Label>
              <select
                id="org-uni"
                required
                value={universityId}
                onChange={(e) => setUniversityId(e.target.value)}
                className="min-h-11 w-full rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100"
              >
                <option value="">Select…</option>
                {(universitiesQuery.data ?? []).map((uni) => (
                  <option key={uni.id} value={uni.id}>
                    {uni.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" isLoading={createMutation.isPending}>
                Create
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Edit organization</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                updateMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-org-name">Name</Label>
                <Input
                  id="edit-org-name"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-org-type">Type</Label>
                <select
                  id="edit-org-type"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as OrganizationType)}
                  className="min-h-11 w-full rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100"
                >
                  <option value="FRATERNITY">Fraternity</option>
                  <option value="SORORITY">Sorority</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" isLoading={updateMutation.isPending}>
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <p className="p-6 text-sm text-ink-500">Loading…</p>
          ) : organizations.length === 0 ? (
            <p className="p-6 text-sm text-ink-500">No organizations yet.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {organizations.map((org) => (
                <li
                  key={org.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-100">{org.name}</p>
                      <Badge variant="outline">{org.type}</Badge>
                    </div>
                    <p className="text-sm text-ink-500">
                      {uniName.get(org.universityId) ?? org.universityId}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(org);
                        setEditName(org.name);
                        setEditType(org.type);
                        setError(null);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(org.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
