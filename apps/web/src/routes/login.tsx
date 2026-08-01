import { useEffect, useState, type FormEvent } from 'react';
import { Link, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BrandLockup } from '@/components/brand/BrandLockup';
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
  pending:
    'Account created. Your account awaits admin approval before you can use Rally.',
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!signupMessage) {
      return;
    }
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
    <div className="mx-auto flex min-h-screen max-w-[var(--content-max)] items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-6 p-8 pb-4">
          <BrandLockup />
          <CardTitle className="text-[28px] font-medium tracking-tight">Log in</CardTitle>
        </CardHeader>
        <CardContent className="p-8 pt-2">
          {successMessage ? (
            <p
              role="status"
              className="mb-4 rounded-md border border-border-strong bg-success-surface px-3 py-2 text-sm text-ink-100"
            >
              {successMessage}
            </p>
          ) : null}
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11"
              />
            </div>
            {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}
            <Button type="submit" className="min-h-11 w-full" isLoading={loading}>
              Continue
            </Button>
          </form>
          <p className="mt-6 text-sm text-ink-500">
            No account?{' '}
            <Link to="/signup" className="text-ink-100 underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
