import { useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Check, Clock, MapPin, Pencil, X } from 'lucide-react';
import type { ProfileSummary } from '@rally/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { logoutRequest } from '@/lib/api';
import { meQueryKey, meQueryOptions, profileSummaryQueryOptions } from '@/lib/auth';
import { canManageOrgPendingApprovals, destinationForUser, isAdminUser } from '@/lib/auth-routing';
import { updateDisplayName } from '@/lib/profile-api';

export const Route = createFileRoute('/app/you')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (user.status !== 'ACTIVE') {
      throw redirect({ to: destinationForUser(user) });
    }
    return { user };
  },
  component: YouPage,
});

function YouPage() {
  const { data: user } = useSuspenseQuery(meQueryOptions);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const summaryQuery = useQuery(profileSummaryQueryOptions);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(user?.name ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!user) {
    return null;
  }
  const currentUser = user;

  async function onLogout() {
    await logoutRequest();
    queryClient.setQueryData(meQueryKey, null);
    await queryClient.invalidateQueries({ queryKey: meQueryKey });
    await navigate({ to: '/login' });
  }

  const nameMutation = useMutation({
    mutationFn: (name: string) => updateDisplayName({ name }),
    onSuccess: async (updatedUser) => {
      queryClient.setQueryData(meQueryKey, updatedUser);
      setDraftName(updatedUser.name);
      setEditingName(false);
      setSaveError(null);
      setSaveSuccess(true);
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
    onError: (error: Error) => {
      setSaveSuccess(false);
      setSaveError(error.message);
    },
  });

  function onEditName() {
    setDraftName(currentUser.name);
    setSaveError(null);
    setSaveSuccess(false);
    setEditingName(true);
  }

  function onCancelName() {
    setDraftName(currentUser.name);
    setSaveError(null);
    setSaveSuccess(false);
    setEditingName(false);
  }

  function onSaveName() {
    const name = draftName.trim();
    setSaveSuccess(false);
    if (!name) {
      setSaveError('Display name is required.');
      return;
    }
    setSaveError(null);
    nameMutation.mutate(name);
  }

  const orgId = user.membership?.organizationId;

  return (
    <div className="w-full space-y-8">
      <header className="space-y-2">
        <p className="rl-eyebrow">Account</p>
        <h1 className="display-lg font-display leading-[1.02]">You</h1>
        <p className="max-w-2xl text-sm text-ink-500">
          Your Rally identity, membership context, permissions, and ticket activity.
        </p>
      </header>

      <Card>
        <CardHeader className="border-b border-border-subtle pb-5">
          <p className="rl-eyebrow">Identity</p>
          <CardTitle className="display-sm font-display mt-2">Profile details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="display-name" className="text-xs text-ink-500">
                  Display name
                </label>
                {!editingName ? (
                  <Button type="button" variant="quiet" size="sm" onClick={onEditName}>
                    <Pencil aria-hidden />
                    Edit
                  </Button>
                ) : null}
              </div>
              {editingName ? (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onSaveName();
                  }}
                >
                  <Input
                    id="display-name"
                    aria-describedby={saveError ? 'display-name-error' : undefined}
                    aria-invalid={saveError ? true : undefined}
                    autoFocus
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    maxLength={120}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" size="sm" isLoading={nameMutation.isPending}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="quiet"
                      size="sm"
                      disabled={nameMutation.isPending}
                      onClick={onCancelName}
                    >
                      <X aria-hidden />
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-base font-medium text-ink-100">{user.name}</p>
              )}
              {saveError ? (
                <p id="display-name-error" className="text-sm text-[color:var(--error)]">
                  {saveError}
                </p>
              ) : null}
              {saveSuccess ? (
                <p className="inline-flex items-center gap-1.5 text-sm text-[color:var(--status-paid)]">
                  <Check size={14} aria-hidden />
                  Display name saved.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-ink-500">Email</p>
              <p className="break-words text-base text-ink-100">{user.email}</p>
              <p className="text-xs text-ink-600">Email is read-only.</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-ink-500">Account status</p>
              <Badge variant="paid">{user.status}</Badge>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-ink-500">Global role</p>
              <p className="text-base font-medium text-ink-100">{user.role}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border-subtle pb-5">
            <p className="rl-eyebrow">Membership</p>
            <CardTitle className="display-sm font-display mt-2">
              {user.membership ? 'Organization access' : 'No organization membership'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {user.membership ? (
              <>
                <p className="text-base font-medium text-ink-100">
                  {user.membership.organizationName ?? user.membership.organizationId}
                </p>
                <p className="text-sm text-ink-500">Current organization membership.</p>
              </>
            ) : (
              <p className="text-sm text-ink-300">
                You are not currently connected to an organization.
              </p>
            )}
            <div className="border-t border-border-subtle pt-4">
              <p className="mb-2 text-xs text-ink-500">Permission keys</p>
              {user.permissions.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {user.permissions.map((permission) => (
                    <li
                      key={permission}
                      className="rounded-full border border-border-subtle px-2.5 py-1 font-mono text-[11px] text-ink-300"
                    >
                      {permission}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-500">No direct permissions recorded.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <SummaryCard query={summaryQuery} />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="divide-y divide-border-subtle p-0">
          {orgId ? (
            <Link
              to="/app/orgs/$orgId/payments"
              params={{ orgId }}
              className="block px-5 py-4 text-sm text-ink-100 transition-colors hover:bg-white/[0.03]"
            >
              Payments
              <span className="mt-0.5 block text-xs text-ink-500">
                Stripe Connect and payout account
              </span>
            </Link>
          ) : null}
          {canManageOrgPendingApprovals(user) ? (
            <Link
              to="/users"
              className="block px-5 py-4 text-sm text-ink-100 transition-colors hover:bg-white/[0.03]"
            >
              Pending approvals
              <span className="mt-0.5 block text-xs text-ink-500">
                Review applicants for your chapter
              </span>
            </Link>
          ) : null}
          {isAdminUser(user) ? (
            <Link
              to="/admin"
              className="block px-5 py-4 text-sm text-ink-100 transition-colors hover:bg-white/[0.03]"
            >
              Admin
              <span className="mt-0.5 block text-xs text-ink-500">Rally HQ console</span>
            </Link>
          ) : null}
          <div className="px-5 py-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void onLogout()}
            >
              Log out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ query }: { query: UseQueryResult<ProfileSummary, Error> }) {
  if (query.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p className="rl-eyebrow">Ticket activity</p>
          <p className="text-sm text-ink-500">Loading your ticket summary…</p>
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="rl-eyebrow">Ticket activity</p>
          <div>
            <p className="display-sm font-display">Summary unavailable</p>
            <p className="mt-2 text-sm text-ink-500">
              {query.error instanceof Error
                ? query.error.message
                : 'Your ticket summary could not be loaded.'}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const summary = query.data;
  if (!summary) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="border-b border-border-subtle pb-5">
        <p className="rl-eyebrow">Ticket activity</p>
        <CardTitle className="display-sm font-display mt-2">Your rally calendar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border-subtle bg-white/[0.02] p-4">
            <p className="num text-2xl font-semibold text-ink-100">{summary.ticketCount}</p>
            <p className="mt-1 text-xs text-ink-500">Non-void tickets</p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-white/[0.02] p-4">
            <p className="num text-2xl font-semibold text-ink-100">{summary.upcomingEventCount}</p>
            <p className="mt-1 text-xs text-ink-500">Upcoming events</p>
          </div>
        </div>

        {summary.nextEvent ? (
          <Link to="/app/tickets" className="group block">
            <div className="rounded-2xl border border-border-subtle bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.05]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="rl-eyebrow">Next event</p>
                  <p className="mt-2 font-display text-xl text-ink-100">
                    {summary.nextEvent.eventName}
                  </p>
                </div>
                <ArrowRight
                  size={17}
                  className="mt-1 shrink-0 text-ink-500 transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-300">
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={13} aria-hidden />
                  {new Date(summary.nextEvent.startsAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
                {summary.nextEvent.location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} aria-hidden />
                    {summary.nextEvent.location}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-ink-500">
                {summary.nextEvent.ticketCount} ticket
                {summary.nextEvent.ticketCount === 1 ? '' : 's'} · View tickets
              </p>
            </div>
          </Link>
        ) : (
          <div className="rounded-2xl border border-dashed border-border-subtle p-4">
            <p className="font-medium text-ink-100">No upcoming events</p>
            <p className="mt-1 text-sm text-ink-500">
              Non-void tickets for future events will appear here.
            </p>
          </div>
        )}

        <Button asChild variant="outline" className="w-full">
          <Link to="/app/tickets">View all tickets</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
