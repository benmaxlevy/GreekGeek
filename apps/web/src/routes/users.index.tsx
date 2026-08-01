import { useState } from 'react';
import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PendingApplicant } from '@rally/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  approvePendingApplicant,
  denyPendingApplicant,
  listPendingApplicants,
} from '@/lib/pending-users-api';

const usersRouteApi = getRouteApi('/users');

export const Route = createFileRoute('/users/')({
  component: OfficerPendingUsersPage,
});

function OfficerPendingUsersPage() {
  const queryClient = useQueryClient();
  const { user } = usersRouteApi.useRouteContext();
  const organizationId = user.membership!.organizationId;
  const [error, setError] = useState<string | null>(null);

  const applicantsQuery = useQuery({
    queryKey: ['org', organizationId, 'pending-users'],
    queryFn: () => listPendingApplicants(organizationId),
  });

  function invalidateApplicants() {
    return queryClient.invalidateQueries({
      queryKey: ['org', organizationId, 'pending-users'],
    });
  }

  const approveMutation = useMutation({
    mutationFn: (userId: string) =>
      approvePendingApplicant(organizationId, userId),
    onSuccess: async () => {
      setError(null);
      await invalidateApplicants();
    },
    onError: (err: Error) => setError(err.message),
  });

  const denyMutation = useMutation({
    mutationFn: (userId: string) =>
      denyPendingApplicant(organizationId, userId),
    onSuccess: async () => {
      setError(null);
      await invalidateApplicants();
    },
    onError: (err: Error) => setError(err.message),
  });

  const applicants = applicantsQuery.data ?? [];
  const busy = approveMutation.isPending || denyMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight">Pending approvals</h1>
        <p className="mt-1 text-sm text-ink-500">
          Applicants who requested your organization. Approve activates with membership to
          that org; deny blocks access.
        </p>
      </div>

      {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}

      <Card>
        <CardContent className="p-0">
          {applicantsQuery.isLoading ? (
            <p className="p-6 text-sm text-ink-500">Loading applicants…</p>
          ) : applicants.length === 0 ? (
            <p className="p-6 text-sm text-ink-500">No pending applicants.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {applicants.map((applicant) => (
                <ApplicantRow
                  key={applicant.id}
                  applicant={applicant}
                  busy={busy}
                  onApprove={() => approveMutation.mutate(applicant.id)}
                  onDeny={() => denyMutation.mutate(applicant.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ApplicantRow({
  applicant,
  busy,
  onApprove,
  onDeny,
}: {
  applicant: PendingApplicant;
  busy: boolean;
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-ink-100">{applicant.name}</p>
          <Badge variant="secondary">{applicant.status}</Badge>
        </div>
        <p className="truncate text-sm text-ink-500">{applicant.email}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={onApprove}>
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={onDeny}
        >
          Deny
        </Button>
      </div>
    </li>
  );
}
