import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { SearchHitDto } from '@fbm/shared';
import { Spinner } from './ui/Spinner';
import { cn } from '../lib/cn';
import { searchGlobal } from '../services/search';

const TYPE_LABELS: Record<SearchHitDto['type'], string> = {
  project: 'Projects',
  invoice: 'Invoices',
  customer: 'Customers',
  supplier: 'Suppliers',
  subcontractor: 'Subcontractors',
  document: 'Documents',
  expense: 'Expenses',
};

const TYPE_ORDER: SearchHitDto['type'][] = [
  'project',
  'customer',
  'invoice',
  'supplier',
  'subcontractor',
  'document',
  'expense',
];

export function GlobalSearch() {
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const enabled = debounced.length >= 2;
  const searchQuery = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => searchGlobal(debounced),
    enabled,
  });

  const results = searchQuery.data?.results ?? [];

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    hits: results.filter((hit) => hit.type === type),
  })).filter((group) => group.hits.length > 0);

  function selectHit(hit: SearchHitDto) {
    setOpen(false);
    setQuery('');
    setDebounced('');
    navigate(hit.link);
  }

  return (
    <div className="relative min-w-0 flex-1" ref={rootRef}>
      <label className="relative block max-w-xl">
        <span className="sr-only">Global search</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open && enabled}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Search projects, invoices…"
          className={cn(
            'h-9 w-full rounded-[var(--radius-md)] border border-border bg-background pr-16 pl-9 text-sm text-ink shadow-[var(--shadow-xs)] transition md:h-10',
            'placeholder:text-subtle',
            'hover:border-border-strong',
            'focus:border-brand focus:bg-panel focus:outline-none focus:ring-2 focus:ring-brand/20',
          )}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Enter' && results[0]) {
              e.preventDefault();
              selectHit(results[0]);
            }
          }}
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-border bg-panel px-1.5 py-0.5 text-[10px] font-medium text-subtle sm:inline-block">
          ⌘K
        </kbd>
      </label>

      {open && enabled ? (
        <div
          id={listId}
          role="listbox"
          className="absolute right-0 left-0 z-50 mt-1.5 max-h-[min(70vh,28rem)] w-full max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-border bg-panel shadow-[var(--shadow-sm)] sm:right-auto"
        >
          {searchQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : searchQuery.isError ? (
            <p className="px-3 py-4 text-sm text-danger">Search failed</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">
              No results for “{debounced}”
            </p>
          ) : (
            <div className="max-h-[min(70vh,28rem)] overflow-y-auto py-1">
              {grouped.map((group) => (
                <div key={group.type} className="py-1">
                  <p className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                    {group.label}
                  </p>
                  <ul>
                    {group.hits.map((hit) => (
                      <li key={`${hit.type}-${hit.id}`}>
                        <button
                          type="button"
                          role="option"
                          className="flex w-full items-start gap-3 px-3 py-2 text-left transition hover:bg-background"
                          onClick={() => selectHit(hit)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {hit.title}
                            </span>
                            {hit.subtitle ? (
                              <span className="block truncate text-xs text-muted">
                                {hit.subtitle}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
