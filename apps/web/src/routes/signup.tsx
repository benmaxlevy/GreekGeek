import { useState, type FormEvent } from 'react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  listPublicOrganizations,
  listPublicUniversities,
  signupRequest,
} from '@/lib/api';

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
            <div className="space-y-2">
              <Label htmlFor="universityId">University (optional)</Label>
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
              <Label htmlFor="organizationId">Organization (optional)</Label>
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
            {catalogError ? (
              <p className="text-sm text-[color:var(--error)]">{catalogError}</p>
            ) : null}
            {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}
            <Button
              type="submit"
              className="min-h-11 w-full"
              isLoading={loading}
              disabled={Boolean(catalogError)}
            >
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
