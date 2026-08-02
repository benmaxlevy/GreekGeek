import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logoutRequest } from '@/lib/api';
import { meQueryKey, meQueryOptions } from '@/lib/auth';
import { destinationForUser } from '@/lib/auth-routing';

export const Route = createFileRoute('/awaiting-approval')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (user.status !== 'PENDING') {
      throw redirect({ to: destinationForUser(user) });
    }
    return { user };
  },
  component: AwaitingApprovalPage,
});

function AwaitingApprovalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = Route.useRouteContext();

  async function onLogout() {
    await logoutRequest();
    queryClient.setQueryData(meQueryKey, null);
    await queryClient.invalidateQueries({ queryKey: meQueryKey });
    await navigate({ to: '/login' });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[var(--content-max)] flex-col px-6 py-8 sm:px-10 sm:py-12">
      <header>
        <BrandLockup />
      </header>
      <main className="flex flex-1 items-center justify-center py-16">
        <Card className="w-full max-w-lg">
          <CardHeader className="p-8 pb-5 sm:p-10 sm:pb-6">
            <p className="rl-eyebrow">Account status</p>
            <CardTitle className="display-md mt-3 font-display font-medium tracking-[-0.03em]">
              Awaiting approval
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-8 pt-0 sm:p-10 sm:pt-0">
            <div className="space-y-3 rounded-[var(--radius-md)] border border-warning/30 bg-warning-surface/70 px-4 py-4">
              <Badge variant="pending">Pending review</Badge>
              <p className="text-sm leading-6 text-ink-300">
                Hi {user.name}. Your account is pending admin review.
              </p>
            </div>
            <p className="text-sm leading-6 text-ink-500">
              You cannot access the app until a platform admin activates your account.
            </p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 w-full"
              onClick={() => void onLogout()}
            >
              Log out
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
