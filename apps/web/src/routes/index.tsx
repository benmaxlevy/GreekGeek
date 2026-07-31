import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { HealthResponseSchema, type HealthResponse } from '@rally/contracts';

export const Route = createFileRoute('/')({
  component: HomePage,
});

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return HealthResponseSchema.parse(await res.json());
}

function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: false,
  });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Rally</h1>
      <p className="text-neutral-600">Phase 1 scaffold — health via Vite proxy.</p>
      <div className="rounded border border-neutral-200 p-4 font-mono text-sm">
        {health.isPending && <p>Checking /api/health…</p>}
        {health.isError && (
          <p className="text-red-600">
            Error: {health.error instanceof Error ? health.error.message : 'Unknown error'}
          </p>
        )}
        {health.data && (
          <pre>{JSON.stringify(health.data, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
