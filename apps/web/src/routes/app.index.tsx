import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { meQueryOptions } from '@/lib/auth';

export const Route = createFileRoute('/app/')({
  component: AppHomePage,
});

function AppHomePage() {
  const { data: user } = useSuspenseQuery(meQueryOptions);

  if (!user) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border-subtle pb-5">
        <p className="rl-eyebrow">Rally home</p>
        <h1 className="display-sm font-display mt-2">Hello, {user.name}</h1>
      </CardHeader>
      <CardContent className="space-y-2 pt-5 text-sm text-ink-300">
        <p>Manage events, ticketing, guests, and payouts from one place.</p>
      </CardContent>
    </Card>
  );
}
