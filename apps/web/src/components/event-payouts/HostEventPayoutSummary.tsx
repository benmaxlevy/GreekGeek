import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { getEventPayoutSummary } from '@/lib/event-payouts-api';
import { EventPayoutSummaryCard } from './EventPayoutSummaryCard';

type HostEventPayoutSummaryProps = {
  eventId: string;
};

export function HostEventPayoutSummary({ eventId }: HostEventPayoutSummaryProps) {
  const summaryQuery = useQuery({
    queryKey: ['event-payouts', 'summary', eventId],
    queryFn: () => getEventPayoutSummary(eventId),
    retry: false,
  });

  if (summaryQuery.isLoading) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-ink-500">Loading payout summary…</p>
        </CardContent>
      </Card>
    );
  }

  if (summaryQuery.isError) {
    return (
      <p className="text-sm text-[color:var(--error)]">{(summaryQuery.error as Error).message}</p>
    );
  }

  return summaryQuery.data ? <EventPayoutSummaryCard summary={summaryQuery.data} /> : null;
}
