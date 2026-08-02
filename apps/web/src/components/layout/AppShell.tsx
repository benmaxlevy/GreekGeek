import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Menu, X } from 'lucide-react';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AppShellNavItem {
  label: string;
  to: string;
  params?: Record<string, string>;
}

export interface AppShellProps {
  children: ReactNode;
  navItems?: AppShellNavItem[];
  footer?: ReactNode;
  portal?: 'member' | 'exec';
}

const DEFAULT_NAV: AppShellNavItem[] = [{ label: 'Home', to: '/app' }];

export function AppShell({
  children,
  navItems = DEFAULT_NAV,
  footer,
  portal,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full" data-portal={portal}>
      <aside
        className={cn(
          'surface-glass-panel fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] flex-col border-r border-border-subtle md:flex',
        )}
      >
        <div className="flex h-[var(--nav-height)] items-center px-5">
          <BrandLockup markSize={36} textSize={14} />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {navItems.map((item) => (
            <Link
              key={`${item.to}:${JSON.stringify(item.params ?? {})}`}
              to={item.to}
              params={item.params}
              className="rl-sidebar-link min-h-11"
              activeProps={{ 'data-active': true }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {footer ? <div className="border-t border-border-subtle p-3">{footer}</div> : null}
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:pl-[var(--sidebar-width)]">
        <header className="flex h-[var(--nav-height)] items-center gap-3 px-4 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X /> : <Menu />}
          </Button>
          <BrandLockup markSize={32} textSize={13} />
        </header>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label="Close drawer"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="surface-glass-panel absolute inset-y-0 left-0 flex w-[min(100%,var(--sidebar-width))] flex-col">
              <div className="flex h-[var(--nav-height)] items-center justify-between px-4">
                <BrandLockup markSize={32} textSize={13} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                >
                  <X />
                </Button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
                {navItems.map((item) => (
                  <Link
                    key={`${item.to}:${JSON.stringify(item.params ?? {})}`}
                    to={item.to}
                    params={item.params}
                    className="rl-sidebar-link min-h-11"
                    activeProps={{ 'data-active': true }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              {footer ? <div className="border-t border-border-subtle p-3">{footer}</div> : null}
            </aside>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-[var(--content-max)] flex-1 px-6 py-8 md:px-12 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
