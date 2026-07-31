import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { meQueryOptions } from '@/lib/auth';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (user) {
      throw redirect({ to: '/app' });
    }
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[var(--content-max)] flex-col items-center justify-center gap-8 px-6 py-16">
      <BrandLockup markSize={48} textSize={18} />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-[28px] font-medium">Welcome to Rally</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-ink-500">Sign in to continue to the app.</p>
          <Button asChild className="min-h-11 w-full">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 w-full">
            <Link to="/signup">Sign up</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
