import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logoutRequest } from '@/lib/api';
import { meQueryKey, meQueryOptions } from '@/lib/auth';
import { destinationForUser } from '@/lib/auth-routing';

export const Route = createFileRoute('/blocked')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (user.status !== 'INACTIVE') {
      throw redirect({ to: destinationForUser(user) });
    }
    return { user };
  },
  component: BlockedPage,
});

function BlockedPage() {
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
    <div className="mx-auto flex min-h-screen max-w-[var(--content-max)] items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-6 p-8 pb-4">
          <BrandLockup />
          <CardTitle className="text-[28px] font-medium tracking-tight">Account inactive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-8 pt-2">
          <p className="text-sm text-ink-300">
            Hi {user.name}. Your account is inactive and cannot access Rally.
          </p>
          <p className="text-sm text-ink-500">
            Contact a platform admin if you believe this is a mistake.
          </p>
          <p className="truncate text-xs text-ink-500">{user.email}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            onClick={() => void onLogout()}
          >
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
