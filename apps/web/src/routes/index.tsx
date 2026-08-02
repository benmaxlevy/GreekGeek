import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { meQueryOptions } from '@/lib/auth';
import { destinationForUser } from '@/lib/auth-routing';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (user) {
      throw redirect({ to: destinationForUser(user) });
    }
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[var(--content-max)] flex-col px-6 py-8 sm:px-10 sm:py-12">
      <header>
        <BrandLockup markSize={44} textSize={17} />
      </header>
      <main className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
        <section className="max-w-xl">
          <p className="rl-eyebrow mb-5">Gather with intention</p>
          <h1 className="display-lg font-display font-medium tracking-[-0.03em] text-ink-100">
            Make room for what brings people together.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-ink-500">
            Rally gives your next gathering a place to begin.
          </p>
        </section>
        <Card className="w-full max-w-md justify-self-end">
          <CardHeader className="p-8 pb-4 sm:p-10 sm:pb-5">
            <p className="rl-eyebrow">Your Rally starts here</p>
            <CardTitle className="display-sm mt-3 font-display font-medium tracking-[-0.02em]">
              Welcome to Rally
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-8 pt-2 sm:p-10 sm:pt-2">
            <p className="mb-3 text-sm leading-6 text-ink-500">Sign in to continue to the app.</p>
            <Button asChild className="min-h-11 w-full">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full">
              <Link to="/signup">Sign up</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
