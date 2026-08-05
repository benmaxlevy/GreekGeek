import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { University } from '@greekgeek/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createUniversity,
  deleteUniversity,
  listUniversities,
  updateUniversity,
} from '@/lib/admin-api';

export const Route = createFileRoute('/admin/universities')({
  component: AdminUniversitiesPage,
});

function AdminUniversitiesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<University | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin', 'universities'],
    queryFn: listUniversities,
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['admin', 'universities'] });
  }

  const createMutation = useMutation({
    mutationFn: () => createUniversity({ name }),
    onSuccess: async () => {
      setName('');
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('No university selected');
      return updateUniversity(editing.id, { name: editName });
    },
    onSuccess: async () => {
      setEditing(null);
      setEditName('');
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUniversity(id),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  function onCreate(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  function onUpdate(event: FormEvent) {
    event.preventDefault();
    updateMutation.mutate();
  }

  const universities = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="rl-eyebrow">Admin / directory</p>
        <h1 className="display-sm">Universities</h1>
        <p className="max-w-2xl text-sm leading-6 text-ink-500">Create and manage universities.</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-[color:var(--error)]/30 bg-[color:var(--error)]/10 px-4 py-3 text-sm text-[color:var(--error)]">
          {error}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader>
          <p className="rl-eyebrow">Directory setup</p>
          <CardTitle className="display-sm">Create university</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onCreate}>
            <div className="flex-1 space-y-2">
              <Label htmlFor="uni-name">Name</Label>
              <Input
                id="uni-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-11"
              />
            </div>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      {editing ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <p className="rl-eyebrow">Directory setup</p>
            <CardTitle className="display-sm">Edit university</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onUpdate}>
              <div className="flex-1 space-y-2">
                <Label htmlFor="edit-uni-name">Name</Label>
                <Input
                  id="edit-uni-name"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <Button type="submit" isLoading={updateMutation.isPending}>
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setEditName('');
                }}
              >
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <p className="p-6 text-sm text-ink-500">Loading…</p>
          ) : universities.length === 0 ? (
            <p className="p-6 text-sm text-ink-500">No universities yet.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {universities.map((uni) => (
                <li
                  key={uni.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="font-medium text-ink-100">{uni.name}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(uni);
                        setEditName(uni.name);
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
                      onClick={() => deleteMutation.mutate(uni.id)}
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
