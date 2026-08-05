import { useEffect, useState, type FormEvent } from 'react';
import { Link, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginRequest } from '@/lib/api';
import { meQueryKey } from '@/lib/auth';
import { destinationForUser } from '@/lib/auth-routing';

type LoginLocationState = {
  signupMessage?: 'ready' | 'pending';
};

const SIGNUP_MESSAGES: Record<NonNullable<LoginLocationState['signupMessage']>, string> = {
  ready: 'Account created. You can sign in now.',
  pending: 'Account created. Your account awaits admin approval before you can use GreekGeek.',
};

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signupMessage = useRouterState({
    select: (state) => (state.location.state as LoginLocationState | undefined)?.signupMessage,
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successKind, setSuccessKind] = useState<'ready' | 'pending' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!signupMessage) {
      return;
    }
    setSuccessKind(signupMessage);
    setSuccessMessage(SIGNUP_MESSAGES[signupMessage]);
    void navigate({ to: '/login', replace: true, state: {} });
  }, [signupMessage, navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await loginRequest({ email, password });
      queryClient.setQueryData(meQueryKey, session.user);
      await navigate({ to: destinationForUser(session.user) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[var(--content-max)] flex-col px-6 py-8 sm:px-10 sm:py-12">
      <header>
        <Link to="/" aria-label="GreekGeek home">
          <BrandLockup />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center py-16">
        <Card className="w-full max-w-lg">
          <CardHeader className="p-8 pb-5 sm:p-10 sm:pb-6">
            <p className="rl-eyebrow">Welcome back</p>
            <CardTitle className="display-md mt-3 font-display font-medium tracking-[-0.03em]">
              Log in
            </CardTitle>
            <p className="mt-3 text-sm leading-6 text-ink-500">Sign in to continue to GreekGeek.</p>
          </CardHeader>
          <CardContent className="p-8 pt-0 sm:p-10 sm:pt-0">
            {successMessage ? (
              <div
                role="status"
                className="mb-6 space-y-2 rounded-[var(--radius-md)] border border-success/30 bg-success-surface/70 px-4 py-3"
              >
                <Badge variant={successKind === 'pending' ? 'pending' : 'paid'}>
                  {successKind === 'pending' ? 'Approval pending' : 'Account ready'}
                </Badge>
                <p className="text-sm leading-6 text-ink-300">{successMessage}</p>
              </div>
            ) : null}
            <form className="flex flex-col gap-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-12"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500"
                >
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-h-12"
                />
              </div>
              {error ? (
                <div
                  role="alert"
                  className="space-y-1 rounded-[var(--radius-md)] border border-error/30 bg-error-surface/70 px-4 py-3"
                >
                  <p className="rl-eyebrow text-error">Could not sign in</p>
                  <p className="text-sm leading-6 text-ink-300">{error}</p>
                </div>
              ) : null}
              <Button type="submit" className="min-h-12 w-full" isLoading={loading}>
                Continue
              </Button>
            </form>
            <p className="mt-7 text-sm text-ink-500">
              No account?{' '}
              <Link to="/signup" className="text-ink-100 underline-offset-4 hover:underline">
                Sign up
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
