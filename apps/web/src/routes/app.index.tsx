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
    <Card>
      <CardHeader>
        <h1 className="text-[28px] font-medium tracking-tight">Hello, {user.name}</h1>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-ink-300">
        <p>Welcome to Rally. Use the sidebar to manage events and tickets.</p>
      </CardContent>
    </Card>
  );
}
