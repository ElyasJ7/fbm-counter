import {
  Building2,
  ChartColumn,
  ChevronsLeft,
  ChevronsRight,
  Contact,
  CreditCard,
  FileText,
  FolderOpen,
  Hammer,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeft,
  Receipt,
  ScrollText,
  Settings,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { APP_NAME, roleHasPermission, type Permission } from '@fbm/shared';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/ui/PageContainer';
import { GlobalSearch } from '../components/GlobalSearch';
import { NotificationsBell } from '../components/NotificationsBell';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/cn';

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
};

type NavGroup = {
  id: string;
  label: string | null;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    id: 'overview',
    label: null,
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { to: '/projects', label: 'Projects', icon: Building2 },
      { to: '/customers', label: 'Customers', icon: Contact },
      {
        to: '/documents',
        label: 'Documents',
        icon: FolderOpen,
        permission: 'documents:read',
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      {
        to: '/finances',
        label: 'Finances',
        icon: Wallet,
        permission: 'finances:read',
      },
      {
        to: '/invoices',
        label: 'Invoices',
        icon: FileText,
        permission: 'invoices:read',
      },
      {
        to: '/payments',
        label: 'Payments',
        icon: CreditCard,
        permission: 'payments:read',
      },
      {
        to: '/expenses',
        label: 'Expenses',
        icon: Receipt,
        permission: 'expenses:read',
      },
      {
        to: '/reports',
        label: 'Reports',
        icon: ChartColumn,
        permission: 'reports:read',
      },
    ],
  },
  {
    id: 'partners',
    label: 'Partners',
    items: [
      {
        to: '/suppliers',
        label: 'Suppliers',
        icon: Truck,
        permission: 'suppliers:read',
      },
      {
        to: '/subcontractors',
        label: 'Subcontractors',
        icon: Hammer,
        permission: 'subcontractors:read',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { to: '/users', label: 'Users', icon: Users, permission: 'users:read' },
      {
        to: '/audit',
        label: 'Audit',
        icon: ScrollText,
        permission: 'audit:read',
      },
      {
        to: '/settings',
        label: 'Settings',
        icon: Settings,
        permission: 'settings:read',
      },
    ],
  },
];

const COLLAPSE_KEY = 'fbm.sidebar.collapsed';

function roleTone(role: string) {
  if (role === 'ADMIN') return 'brand' as const;
  if (role === 'MANAGEMENT') return 'warning' as const;
  if (role === 'ACCOUNTING') return 'success' as const;
  return 'neutral' as const;
}

function filterGroups(
  groups: NavGroup[],
  can: (permission?: Permission) => boolean,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => can(item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const navId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const wasMobileOpen = useRef(false);

  const visibleGroups = filterGroups(navGroups, (permission) => {
    if (!permission) return true;
    if (!user) return false;
    return roleHasPermission(user.role, permission);
  });

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (wasMobileOpen.current && !mobileOpen && !isDesktop) {
      menuBtnRef.current?.focus({ preventScroll: true });
    }
    wasMobileOpen.current = mobileOpen;
  }, [mobileOpen, isDesktop]);

  function toggleCollapsed() {
    setCollapsed((value) => !value);
  }

  const drawerInert = !isDesktop && !mobileOpen;

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-panel focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-[var(--shadow-sm)]"
      >
        Skip to main content
      </a>

      <div className="flex min-h-screen w-full">
        <aside
          id={navId}
          inert={drawerInert || undefined}
          aria-hidden={drawerInert || undefined}
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-panel transition-[width,transform] duration-200 lg:static lg:translate-x-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
            collapsed ? 'w-[4.25rem] lg:w-[4.25rem]' : 'w-64',
            'max-lg:w-[min(100%,20rem)]',
          )}
          aria-label="Main navigation"
        >
          <div
            className={cn(
              'flex h-14 items-center border-b border-border md:h-16',
              collapsed
                ? 'justify-center px-2 max-lg:justify-between max-lg:px-4'
                : 'justify-between px-4',
            )}
          >
            <div className={cn('min-w-0', collapsed && 'lg:hidden')}>
              <p className="truncate text-sm font-semibold tracking-wide text-brand">
                {APP_NAME}
              </p>
              <p className="text-caption">Construction Finance</p>
            </div>
            {collapsed ? (
              <span
                className="hidden h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-xs font-bold text-brand lg:flex"
                aria-hidden
              >
                FBM
              </span>
            ) : null}
            <button
              ref={closeBtnRef}
              type="button"
              className="rounded-[var(--radius-sm)] p-2 text-muted hover:bg-background hover:text-ink lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
            {visibleGroups.map((group, groupIndex) => (
              <div key={group.id} className={cn(groupIndex > 0 && 'mt-4')}>
                {group.label ? (
                  <p
                    className={cn(
                      'mb-1.5 px-2 text-[10px] font-semibold tracking-wider text-subtle uppercase',
                      collapsed && 'lg:sr-only',
                    )}
                  >
                    {group.label}
                  </p>
                ) : null}
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.to === '/'}
                          title={collapsed ? item.label : undefined}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              'group relative flex min-h-10 items-center gap-3 rounded-[var(--radius-md)] px-2.5 py-2 text-sm font-medium text-muted transition',
                              'hover:bg-background hover:text-ink',
                              isActive &&
                                'bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand',
                              isActive &&
                                'before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-brand',
                              collapsed && 'lg:justify-center lg:px-0',
                            )
                          }
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          <span className={cn(collapsed && 'lg:hidden')}>
                            {item.label}
                          </span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="hidden border-t border-border p-2 lg:block">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-xs font-medium text-muted transition hover:bg-background hover:text-ink"
              aria-pressed={collapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronsRight className="h-4 w-4" aria-hidden />
              ) : (
                <>
                  <ChevronsLeft className="h-4 w-4" aria-hidden />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>

          <div className="border-t border-border p-3 lg:hidden">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {user?.firstName} {user?.lastName}
                </p>
                <Badge tone={roleTone(user?.role ?? 'VIEWER')}>
                  {user?.role}
                </Badge>
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
            className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-[1px] lg:hidden"
            aria-label="Close navigation overlay"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-panel/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:gap-3 sm:px-4 md:h-16">
            <button
              ref={menuBtnRef}
              type="button"
              className="rounded-[var(--radius-sm)] p-2 text-muted hover:bg-background hover:text-ink lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-controls={navId}
              aria-expanded={mobileOpen}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            <button
              type="button"
              className="hidden rounded-[var(--radius-sm)] p-2 text-muted hover:bg-background hover:text-ink lg:inline-flex xl:hidden"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={collapsed}
            >
              <PanelLeft className="h-5 w-5" aria-hidden />
            </button>

            <GlobalSearch />

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <NotificationsBell />
              <div className="hidden items-center gap-2.5 border-l border-border pl-3 sm:flex">
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-medium text-ink">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <div className="flex justify-end">
                    <Badge tone={roleTone(user?.role ?? 'VIEWER')}>
                      {user?.role}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void logout()}
                  aria-label="Log out"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  <span className="hidden md:inline">Log out</span>
                </Button>
              </div>
            </div>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 md:p-6"
          >
            <PageContainer>
              <Outlet />
            </PageContainer>
          </main>
        </div>
      </div>
    </div>
  );
}
