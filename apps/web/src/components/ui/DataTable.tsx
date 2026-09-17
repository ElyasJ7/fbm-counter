import { cn } from '../../lib/cn';

type DataTableProps = {
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  /** Accessible name for the scrollable table region */
  'aria-label'?: string;
};

/**
 * Consistent bordered table shell for list pages.
 * Pass a full <table> as children. Scrolls horizontally on narrow screens.
 */
export function DataTable({
  children,
  className,
  footer,
  'aria-label': ariaLabel = 'Data table',
}: DataTableProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-lg)] border border-border bg-panel shadow-[var(--shadow-xs)]',
        className,
      )}
    >
      <div
        className="table-scroll"
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        {children}
      </div>
      {footer ? (
        <div className="flex flex-col gap-2 border-t border-border px-3 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-4">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function dataTableHeadClassName() {
  return 'sticky top-0 z-[1] border-b border-border bg-panel';
}

export function dataTableThClassName(align: 'left' | 'right' = 'left') {
  return cn(
    'text-table-header whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3',
    align === 'right' && 'text-right',
  );
}

export function dataTableTdClassName(align: 'left' | 'right' = 'left') {
  return cn(
    'px-3 py-2.5 align-middle sm:px-4 sm:py-3',
    align === 'right' && 'text-right',
  );
}

export function dataTableRowClassName() {
  return 'border-b border-border/70 transition hover:bg-background/80 last:border-0';
}
