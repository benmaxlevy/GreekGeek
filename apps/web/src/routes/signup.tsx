import { useState, type FormEvent } from 'react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listPublicOrganizations, listPublicUniversities, signupRequest } from '@/lib/api';

declare module '@tanstack/react-router' {
  interface HistoryState {
    signupMessage?: 'ready' | 'pending';
  }
}

export const Route = createFileRoute('/signup')({
  component: SignupPage,
});

const selectClassName =
  'min-h-11 w-full rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100 disabled:cursor-not-allowed disabled:opacity-50';

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const universitiesQuery = useQuery({
    queryKey: ['public', 'universities'],
    queryFn: listPublicUniversities,
    retry: 3,
  });

  const organizationsQuery = useQuery({
    queryKey: ['public', 'organizations', universityId],
    queryFn: () => listPublicOrganizations(universityId),
    enabled: Boolean(universityId),
    retry: 3,
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = organizationId
        ? { name, email, password, organizationId }
        : { name, email, password };
      await signupRequest(payload);
      await navigate({
        to: '/login',
        state: { signupMessage: organizationId ? 'pending' : 'ready' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  const catalogError =
    universitiesQuery.error instanceof Error
      ? universitiesQuery.error.message
      : organizationsQuery.error instanceof Error
        ? organizationsQuery.error.message
        : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-[var(--content-max)] flex-col px-6 py-8 sm:px-10 sm:py-12">
      <header>
        <Link to="/" aria-label="Rally home">
          <BrandLockup />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center py-16">
        <Card className="w-full max-w-2xl">
          <CardHeader className="p-8 pb-5 sm:p-10 sm:pb-6">
            <p className="rl-eyebrow">Join Rally</p>
            <CardTitle className="display-md mt-3 font-display font-medium tracking-[-0.03em]">
              Create account
            </CardTitle>
            <p className="mt-3 text-sm leading-6 text-ink-500">
              Bring your next gathering into focus.
            </p>
          </CardHeader>
          <CardContent className="p-8 pt-0 sm:p-10 sm:pt-0">
            <form className="flex flex-col gap-5" onSubmit={onSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500"
                  >
                    Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="min-h-12"
                  />
                </div>
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
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-h-12"
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="universityId"
                    className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500"
                  >
                    University (optional)
                  </Label>
                  <select
                    id="universityId"
                    value={universityId}
                    disabled={universitiesQuery.isLoading || !universitiesQuery.data?.length}
                    onChange={(e) => {
                      setUniversityId(e.target.value);
                      setOrganizationId('');
                    }}
                    className={selectClassName}
                  >
                    <option value="">
                      {universitiesQuery.isLoading ? 'Loading universities…' : 'No university…'}
                    </option>
                    {(universitiesQuery.data ?? []).map((uni) => (
                      <option key={uni.id} value={uni.id}>
                        {uni.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="organizationId"
                    className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500"
                  >
                    Organization (optional)
                  </Label>
                  <select
                    id="organizationId"
                    value={organizationId}
                    disabled={!universityId || organizationsQuery.isLoading}
                    onChange={(e) => setOrganizationId(e.target.value)}
                    className={selectClassName}
                  >
                    <option value="">
                      {!universityId
                        ? 'Select university first…'
                        : organizationsQuery.isLoading
                          ? 'Loading organizations…'
                          : 'No organization…'}
                    </option>
                    {(organizationsQuery.data ?? []).map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {catalogError ? (
                <div
                  role="alert"
                  className="space-y-1 rounded-[var(--radius-md)] border border-error/30 bg-error-surface/70 px-4 py-3"
                >
                  <Badge variant="destructive">Catalog unavailable</Badge>
                  <p className="text-sm leading-6 text-ink-300">{catalogError}</p>
                </div>
              ) : null}
              {error ? (
                <div
                  role="alert"
                  className="space-y-1 rounded-[var(--radius-md)] border border-error/30 bg-error-surface/70 px-4 py-3"
                >
                  <p className="rl-eyebrow text-error">Could not create account</p>
                  <p className="text-sm leading-6 text-ink-300">{error}</p>
                </div>
              ) : null}
              <Button
                type="submit"
                className="min-h-12 w-full"
                isLoading={loading}
                disabled={Boolean(catalogError)}
              >
                Sign up
              </Button>
            </form>
            <p className="mt-7 text-sm text-ink-500">
              Already have an account?{' '}
              <Link to="/login" className="text-ink-100 underline-offset-4 hover:underline">
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
