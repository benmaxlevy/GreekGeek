import type { EventPayoutSummary as EventPayoutSummaryData } from '@rally/contracts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCents, formatDateTime, formatPayoutReason } from './formatters';

type EventPayoutSummaryCardProps = {
  summary: EventPayoutSummaryData;
  title?: string;
};

export function EventPayoutSummaryCard({
  summary,
  title = 'Payout summary',
}: EventPayoutSummaryCardProps) {
  const latestAudit = summary.audits.at(-1);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-lg">{title}</CardTitle>
        <div className="flex flex-wrap gap-2">
          {summary.heldAt ? <Badge variant="destructive">On hold</Badge> : null}
          {summary.postReleaseExposure ? (
            <Badge variant="destructive">Post-release dispute exposure</Badge>
          ) : null}
          {summary.blockedReason ? (
            <Badge variant="secondary">{formatPayoutReason(summary.blockedReason)}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-500">Gross sales</dt>
            <dd className="mt-1 text-lg font-medium text-ink-100">
              {formatCents(summary.grossAmountCents)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Rally fee</dt>
            <dd className="mt-1 text-lg font-medium text-ink-100">
              {formatCents(summary.feeCents)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Net proceeds</dt>
            <dd className="mt-1 text-lg font-medium text-ink-100">
              {formatCents(summary.netCents)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Released</dt>
            <dd className="mt-1 text-ink-100">{formatCents(summary.releasedCents)}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Pending</dt>
            <dd className="mt-1 text-ink-100">{formatCents(summary.pendingCents)}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Excluded</dt>
            <dd className="mt-1 text-ink-100">
              {formatCents(summary.excludedCents)} ({summary.excludedCount})
            </dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="text-ink-500">Expected payout date</dt>
            <dd className="mt-1 text-ink-100">{formatDateTime(summary.expectedPayoutDate)}</dd>
          </div>
        </dl>

        {summary.excludedCount > 0 ? (
          <div className="rounded-md border border-border-subtle bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-ink-100">Excluded purchases</p>
            <p className="mt-1 text-sm text-ink-400">
              {summary.excludedCount} purchase{summary.excludedCount === 1 ? '' : 's'} ·{' '}
              {formatCents(summary.excludedCents)}
            </p>
            <ul className="mt-3 grid gap-2 text-sm text-ink-300 sm:grid-cols-3">
              {Object.entries(summary.excludedByReason).map(([reason, count]) => (
                <li key={reason}>
                  <span className="text-ink-500">{formatPayoutReason(reason)}:</span> {count}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="text-sm font-medium text-ink-100">Released history</p>
          {summary.payouts.length === 0 ? (
            <p className="mt-2 text-sm text-ink-500">No payout batches yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border-subtle rounded-md border border-border-subtle">
              {summary.payouts.map((payout) => (
                <li
                  key={payout.id}
                  className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-ink-300">
                    Batch {payout.batchSeq} · {formatCents(payout.amountCents)}
                  </span>
                  <span className="text-ink-500">
                    {payout.status} · {formatDateTime(payout.releasedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {latestAudit ? (
          <div>
            <p className="text-sm font-medium text-ink-100">Latest audit</p>
            <p className="mt-2 text-sm text-ink-400">
              {formatPayoutReason(latestAudit.action)} — {latestAudit.reason} ·{' '}
              {formatDateTime(latestAudit.createdAt)}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
