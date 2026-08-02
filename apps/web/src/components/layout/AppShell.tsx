import { useState, type ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Menu, X, type LucideIcon } from 'lucide-react';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AppShellNavItem {
  label: string;
  to: string;
  params?: Record<string, string>;
  icon?: LucideIcon;
  /** Exact path match for active state (Upcoming /app). */
  exact?: boolean;
}

export interface AppShellProps {
  children: ReactNode;
  navItems?: AppShellNavItem[];
  footer?: ReactNode;
  portal?: 'member' | 'exec';
  /** Member app uses bottom tabs; exec/admin keep sidebar. */
  navigation?: 'sidebar' | 'bottom';
  navigationLabel?: string;
}

const DEFAULT_NAV: AppShellNavItem[] = [{ label: 'Upcoming', to: '/app', exact: true }];

function pathIsActive(pathname: string, item: AppShellNavItem): boolean {
  if (item.exact) {
    return pathname === item.to || pathname === `${item.to}/`;
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function AppShell({
  children,
  navItems = DEFAULT_NAV,
  footer,
  portal,
  navigation = 'sidebar',
  navigationLabel = 'Primary',
}: AppShellProps) {
  if (navigation === 'bottom') {
    return (
      <BottomAppShell
        portal={portal}
        navItems={navItems}
        footer={footer}
        navigationLabel={navigationLabel}
      >
        {children}
      </BottomAppShell>
    );
  }

  return (
    <SidebarAppShell portal={portal} navItems={navItems} footer={footer}>
      {children}
    </SidebarAppShell>
  );
}

function BottomAppShell({
  children,
  navItems,
  footer,
  portal,
  navigationLabel,
}: {
  children: ReactNode;
  navItems: AppShellNavItem[];
  footer?: ReactNode;
  portal?: 'member' | 'exec';
  navigationLabel: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const scrollable = navItems.length > 5;

  return (
    <div className="flex min-h-dvh w-full flex-col" data-portal={portal}>
      <header
        className="sticky top-0 z-30 flex h-[60px] items-center justify-between gap-3 border-b border-border-subtle px-4 md:px-8"
        style={{
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        }}
      >
        <BrandLockup markSize={28} textSize={15} />
        {footer ? <div className="min-w-0 shrink-0">{footer}</div> : null}
      </header>

      <main className="mx-auto w-full max-w-[var(--content-max)] flex-1 px-4 pb-28 pt-5 md:px-10 md:pt-8">
        {children}
      </main>

      <nav
        aria-label={navigationLabel}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle"
        style={{
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        }}
      >
        <ul
          className={cn(
            'mx-auto flex w-full max-w-[var(--content-max)]',
            scrollable ? 'justify-start overflow-x-auto' : '',
          )}
        >
          {navItems.map((item) => {
            const active = pathIsActive(pathname, item);
            const Icon = item.icon;
            return (
              <li
                key={`${item.to}:${JSON.stringify(item.params ?? {})}`}
                className={scrollable ? 'min-w-[82px] flex-none' : 'flex-1'}
              >
                <Link
                  to={item.to}
                  params={item.params}
                  aria-current={active ? 'page' : undefined}
                  className="relative flex min-h-14 flex-col items-center justify-center gap-1 pb-[env(safe-area-inset-bottom)] text-[10.5px]"
                  style={{ color: active ? 'var(--ink-100)' : 'var(--ink-500)' }}
                >
                  {Icon ? (
                    <Icon size={19} strokeWidth={active ? 2.2 : 1.7} aria-hidden />
                  ) : null}
                  {item.label}
                  {active ? (
                    <span
                      className="absolute top-0 h-0.5 w-8 rounded-full bg-ink-100"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SidebarAppShell({
  children,
  navItems,
  footer,
  portal,
}: {
  children: ReactNode;
  navItems: AppShellNavItem[];
  footer?: ReactNode;
  portal?: 'member' | 'exec';
}) {
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
