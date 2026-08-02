import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EventPayoutSummaryCard } from '@/components/event-payouts/EventPayoutSummaryCard';
import {
  clearEventHold,
  holdEvent,
  listEventPayoutQueue,
  releaseEventPayout,
  retryEventPayout,
} from '@/lib/event-payouts-api';
import {
  formatCents,
  formatDateTime,
  formatPayoutReason,
} from '@/components/event-payouts/formatters';

export const Route = createFileRoute('/admin/event-payouts')({
  component: AdminEventPayoutsPage,
});

function AdminEventPayoutsPage() {
  const queryClient = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: ['admin', 'event-payouts'],
    queryFn: listEventPayoutQueue,
    retry: false,
  });

  async function invalidateQueue() {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'event-payouts'] });
  }

  const releaseMutation = useMutation({
    mutationFn: ({ eventId, reason }: { eventId: string; reason: string }) =>
      releaseEventPayout(eventId, { reason }),
    onSuccess: async (result) => {
      setError(null);
      setAuditResult(
        `Release audit recorded: ${result.audit.reason} · ${formatDateTime(result.audit.createdAt)}`,
      );
      await invalidateQueue();
    },
    onError: (err: Error) => setError(err.message),
  });

  const retryMutation = useMutation({
    mutationFn: ({
      eventId,
      payoutId,
      reason,
    }: {
      eventId: string;
      payoutId: string;
      reason: string;
    }) => retryEventPayout(eventId, payoutId, { reason }),
    onSuccess: async (result) => {
      setError(null);
      setAuditResult(
        `Retry audit recorded: ${result.audit.reason} · ${formatDateTime(result.audit.createdAt)}`,
      );
      await invalidateQueue();
    },
    onError: (err: Error) => setError(err.message),
  });

  const holdMutation = useMutation({
    mutationFn: ({ eventId, reason }: { eventId: string; reason: string }) =>
      holdEvent(eventId, { reason }),
    onSuccess: async () => {
      setError(null);
      setAuditResult('Hold request recorded; queue refreshed.');
      await invalidateQueue();
    },
    onError: (err: Error) => setError(err.message),
  });

  const clearHoldMutation = useMutation({
    mutationFn: ({ eventId, reason }: { eventId: string; reason: string }) =>
      clearEventHold(eventId, { reason }),
    onSuccess: async () => {
      setError(null);
      setAuditResult('Clear-hold request recorded; queue refreshed.');
      await invalidateQueue();
    },
    onError: (err: Error) => setError(err.message),
  });

  const queue = queueQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="rl-eyebrow">Admin / finance</p>
        <h1 className="display-sm">Event payouts</h1>
        <p className="max-w-2xl text-sm leading-6 text-ink-500">
          Review payout readiness, release state, exclusions, and audited operations.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-[color:var(--error)]/30 bg-[color:var(--error)]/10 px-4 py-3 text-sm text-[color:var(--error)]">
          {error}
        </p>
      ) : null}
      {auditResult ? (
        <p className="rounded-lg border border-border-subtle bg-white/[0.03] px-4 py-3 text-sm text-ink-300">
          {auditResult}
        </p>
      ) : null}

      {queueQuery.isLoading ? (
        <p className="text-sm text-ink-500">Loading payout queue…</p>
      ) : queueQuery.isError ? (
        <p className="text-sm text-[color:var(--error)]">{(queueQuery.error as Error).message}</p>
      ) : queue.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-ink-500">No event payout records.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => {
            const failedPayouts = item.payouts.filter((payout) => payout.status === 'failed');
            const state = item.heldAt
              ? 'Held'
              : failedPayouts.length > 0
                ? 'Failed'
                : item.postReleaseExposure
                  ? 'Post-release dispute'
                  : item.blockedReason
                    ? 'Blocked'
                    : item.eligibleNow
                      ? 'Eligible now'
                      : 'Pending';
            const reason = reasons[item.eventId] ?? '';
            const latestAudit = item.audits[item.audits.length - 1];

            return (
              <Card key={item.eventId} className="overflow-hidden">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                  <div>
                    <p className="rl-eyebrow">Payout queue</p>
                    <CardTitle className="display-sm">Event {item.eventId}</CardTitle>
                    <p className="mt-1 text-sm text-ink-500">
                      Expected payout {formatDateTime(item.expectedPayoutDate)}
                    </p>
                  </div>
                  <Badge variant={state === 'Eligible now' ? 'default' : 'secondary'}>
                    {state}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-5">
                  <dl className="grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-ink-500">Gross / fee / net</dt>
                      <dd className="num mt-1 text-ink-100">
                        {formatCents(item.grossAmountCents)} / {formatCents(item.feeCents)} /{' '}
                        {formatCents(item.netCents)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Released / pending</dt>
                      <dd className="num mt-1 text-ink-100">
                        {formatCents(item.releasedCents)} / {formatCents(item.pendingCents)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Excluded</dt>
                      <dd className="num mt-1 text-ink-100">
                        {formatCents(item.excludedCents)} ({item.excludedCount})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Connect readiness</dt>
                      <dd className="mt-1 text-ink-100">
                        {item.readiness.ready ? 'Ready' : 'Blocked'}
                        {item.readiness.blockedReason
                          ? ` · ${formatPayoutReason(item.readiness.blockedReason)}`
                          : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Hold state</dt>
                      <dd className="mt-1 text-ink-100">
                        {item.heldAt ? `Held ${formatDateTime(item.heldAt)}` : 'Not held'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Blocked reason</dt>
                      <dd className="mt-1 text-ink-100">
                        {formatPayoutReason(item.blockedReason)}
                      </dd>
                    </div>
                  </dl>

                  <EventPayoutSummaryCard summary={item} title="Financial summary" />

                  {failedPayouts.length > 0 ? (
                    <div className="rounded-md border border-[color:var(--status-overdue)]/40 p-4">
                      <p className="text-sm font-medium text-ink-100">Failed transfers</p>
                      <ul className="mt-2 space-y-2 text-sm text-ink-300">
                        {failedPayouts.map((payout) => (
                          <li
                            key={payout.id}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span>
                              Batch {payout.batchSeq} · {payout.attempts} attempt
                              {payout.attempts === 1 ? '' : 's'} ·{' '}
                              {payout.lastError ?? 'Unknown error'}
                              {payout.stripeTransferId ? ` · ${payout.stripeTransferId}` : ''}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!reason.trim() || retryMutation.isPending}
                              onClick={() =>
                                retryMutation.mutate({
                                  eventId: item.eventId,
                                  payoutId: payout.id,
                                  reason: reason.trim(),
                                })
                              }
                            >
                              Retry
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <label
                      className="block text-sm text-ink-500"
                      htmlFor={`payout-reason-${item.eventId}`}
                    >
                      Reason required for every admin action
                    </label>
                    <Input
                      id={`payout-reason-${item.eventId}`}
                      value={reason}
                      maxLength={1000}
                      placeholder="Explain this payout operation"
                      onChange={(e) =>
                        setReasons((current) => ({ ...current, [item.eventId]: e.target.value }))
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!reason.trim() || releaseMutation.isPending}
                        onClick={() =>
                          releaseMutation.mutate({
                            eventId: item.eventId,
                            reason: reason.trim(),
                          })
                        }
                      >
                        Release
                      </Button>
                      {item.heldAt ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!reason.trim() || clearHoldMutation.isPending}
                          onClick={() =>
                            clearHoldMutation.mutate({
                              eventId: item.eventId,
                              reason: reason.trim(),
                            })
                          }
                        >
                          Clear hold
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!reason.trim() || holdMutation.isPending}
                          onClick={() =>
                            holdMutation.mutate({
                              eventId: item.eventId,
                              reason: reason.trim(),
                            })
                          }
                        >
                          Hold
                        </Button>
                      )}
                    </div>
                  </div>

                  {latestAudit ? (
                    <div className="border-t border-border-subtle pt-4 text-sm text-ink-400">
                      <p className="font-medium text-ink-100">Latest audit result</p>
                      <p className="mt-1">
                        {formatPayoutReason(latestAudit.action)} · {latestAudit.reason} · actor{' '}
                        {latestAudit.actorUserId} · {formatDateTime(latestAudit.createdAt)}
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
