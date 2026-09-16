import {
  Bell,
  Building2,
  ClipboardList,
  Contact,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Receipt,
  Search,
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
import { APP_NAME } from '@fbm/shared';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/cn';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: Building2 },
  { to: '/customers', label: 'Customers', icon: Contact },
  { to: '/finances', label: 'Finances', icon: Wallet },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/subcontractors', label: 'Subcontractors', icon: Hammer },
  { to: '/documents', label: 'Documents', icon: FolderOpen },
  { to: '/reports', label: 'Reports', icon: ChartColumn },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

function roleTone(role: string) {
  if (role === 'ADMIN') return 'brand' as const;
  if (role === 'MANAGEMENT') return 'warning' as const;
  if (role === 'ACCOUNTING') return 'success' as const;
  return 'neutral' as const;
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-64 border-r border-[var(--color-border)] bg-[var(--color-panel)] transition-transform lg:static lg:translate-x-0',
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
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900',
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
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-4">
            <button
              type="button"
              className="rounded p-2 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <label className="relative hidden min-w-0 flex-1 md:block">
              <span className="sr-only">Global search</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search projects, invoices, suppliers…"
                className="h-10 w-full max-w-xl rounded-md border border-[var(--color-border)] bg-slate-50 pr-3 pl-9 text-sm"
                disabled
                title="Global search arrives in a later phase"
              />
            </label>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" size="sm" className="hidden sm:inline-flex">
                <ClipboardList className="h-4 w-4" />
                Quick action
              </Button>
              <button
                type="button"
                className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Notifications"
                title="Notifications arrive in a later phase"
              >
                <Bell className="h-5 w-5" />
              </button>
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

          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
