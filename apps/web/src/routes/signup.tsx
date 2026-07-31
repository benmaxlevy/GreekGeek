import { useState, type FormEvent } from 'react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signupRequest } from '@/lib/api';
import { meQueryKey } from '@/lib/auth';

export const Route = createFileRoute('/signup')({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await signupRequest({ name, email, password });
      queryClient.setQueryData(meQueryKey, session.user);
      await navigate({ to: '/app' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[var(--content-max)] items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-6 p-8 pb-4">
          <BrandLockup />
          <CardTitle className="text-[28px] font-medium tracking-tight">Create account</CardTitle>
        </CardHeader>
        <CardContent className="p-8 pt-2">
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-11"
              />
            </div>
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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11"
              />
            </div>
            {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}
            <Button type="submit" className="min-h-11 w-full" isLoading={loading}>
              Sign up
            </Button>
          </form>
          <p className="mt-6 text-sm text-ink-500">
            Already have an account?{' '}
            <Link to="/login" className="text-ink-100 underline-offset-4 hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
