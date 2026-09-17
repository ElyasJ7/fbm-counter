import {
  Building2,
  Contact,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  ScrollText,
  Settings,
  Users,
  Wallet,
  X,
  Truck,
  Hammer,
  CreditCard,
  ChartColumn,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { APP_NAME, roleHasPermission, type Permission } from '@fbm/shared';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { GlobalSearch } from '../components/GlobalSearch';
import { NotificationsBell } from '../components/NotificationsBell';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/cn';

const navItems: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
}> = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: Building2 },
  { to: '/customers', label: 'Customers', icon: Contact },
  { to: '/finances', label: 'Finances', icon: Wallet, permission: 'finances:read' },
  { to: '/invoices', label: 'Invoices', icon: FileText, permission: 'invoices:read' },
  { to: '/payments', label: 'Payments', icon: CreditCard, permission: 'payments:read' },
  { to: '/expenses', label: 'Expenses', icon: Receipt, permission: 'expenses:read' },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, permission: 'suppliers:read' },
  {
    to: '/subcontractors',
    label: 'Subcontractors',
    icon: Hammer,
    permission: 'subcontractors:read',
  },
  { to: '/documents', label: 'Documents', icon: FolderOpen, permission: 'documents:read' },
  { to: '/reports', label: 'Reports', icon: ChartColumn, permission: 'reports:read' },
  { to: '/users', label: 'Users', icon: Users, permission: 'users:read' },
  { to: '/audit', label: 'Audit', icon: ScrollText, permission: 'audit:read' },
  {
    to: '/settings',
    label: 'Settings',
    icon: Settings,
    permission: 'settings:read',
  },
];

function roleTone(role: string) {
  if (role === 'ADMIN') return 'brand' as const;
  if (role === 'MANAGEMENT') return 'warning' as const;
  if (role === 'ACCOUNTING') return 'success' as const;
  return 'neutral' as const;
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = navItems.filter((item) => {
    if (!item.permission) return true;
    if (!user) return false;
    return roleHasPermission(user.role, item.permission);
  });

  return (
    <div className="flex min-h-screen bg-[var(--color-surface)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow"
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen w-full">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)] transition-transform lg:static lg:translate-x-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-label="Main navigation"
        >
          <div className="flex h-16 items-center justify-between border-b border-[var(--color-border)] px-4">
            <div>
              <p className="text-sm font-semibold tracking-wide text-[var(--color-brand)]">
                {APP_NAME}
              </p>
              <p className="text-xs text-[var(--color-muted)]">Construction Finance</p>
            </div>
            <button
              type="button"
              className="rounded p-1 lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                      isActive &&
                        'bg-[var(--color-brand-soft)] text-[var(--color-brand)]',
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="border-t border-[var(--color-border)] p-3 lg:hidden">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {user?.firstName} {user?.lastName}
                </p>
                <Badge tone={roleTone(user?.role ?? 'VIEWER')}>{user?.role}</Badge>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => void logout()}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Log out
            </Button>
          </div>
        </aside>

        {mobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
            aria-label="Close navigation overlay"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-3 sm:gap-3 sm:px-4">
            <button
              type="button"
              className="rounded p-2 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            <GlobalSearch />

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <NotificationsBell />
              <div className="hidden items-center gap-2 border-l border-[var(--color-border)] pl-3 sm:flex">
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <div className="flex justify-end">
                    <Badge tone={roleTone(user?.role ?? 'VIEWER')}>{user?.role}</Badge>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void logout()}>
                  Log out
                </Button>
              </div>
            </div>
          </header>

          <main id="main-content" tabIndex={-1} className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
