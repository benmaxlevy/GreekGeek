import { createFileRoute } from '@tanstack/react-router';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/')({
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
          <p className="text-sm text-ink-500">
            Obsidian-glass theme and shell are ready. Auth routes land next.
          </p>
          <Button type="button" className="min-h-11 w-full">
            Chrome button
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
