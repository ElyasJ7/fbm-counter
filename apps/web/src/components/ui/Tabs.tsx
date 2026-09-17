import { useRef } from 'react';
import { cn } from '../../lib/cn';

export type TabItem = {
  id: string;
  label: string;
  disabled?: boolean;
};

type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  'aria-label'?: string;
  className?: string;
};

/** Horizontally scrollable tab list with arrow-key navigation. */
export function Tabs({
  items,
  value,
  onChange,
  'aria-label': ariaLabel = 'Sections',
  className,
}: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const enabled = items.filter((item) => !item.disabled);

  function focusTab(id: string) {
    const root = listRef.current;
    if (!root) return;
    const button = root.querySelector<HTMLButtonElement>(
      `[data-tab-id="${id}"]`,
    );
    button?.focus();
  }

  function move(delta: number) {
    const index = enabled.findIndex((item) => item.id === value);
    if (index < 0 || enabled.length === 0) return;
    const next = enabled[(index + delta + enabled.length) % enabled.length];
    onChange(next.id);
    focusTab(next.id);
  }

  return (
    <div
      className={cn(
        'table-scroll border-b border-border',
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
      ref={listRef}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          move(1);
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          move(-1);
        }
        if (event.key === 'Home') {
          event.preventDefault();
          onChange(enabled[0].id);
          focusTab(enabled[0].id);
        }
        if (event.key === 'End') {
          event.preventDefault();
          const last = enabled[enabled.length - 1];
          onChange(last.id);
          focusTab(last.id);
        }
      }}
    >
      <div className="flex min-w-max gap-0.5">
        {items.map((tab) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-tab-id={tab.id}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => {
                if (!tab.disabled) onChange(tab.id);
              }}
              className={cn(
                'relative shrink-0 px-3 py-2.5 text-sm font-medium transition',
                selected ? 'text-brand' : 'text-muted hover:text-ink',
                tab.disabled && 'cursor-not-allowed opacity-40',
                selected &&
                  'after:absolute after:right-2 after:bottom-0 after:left-2 after:h-0.5 after:rounded-full after:bg-brand',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
