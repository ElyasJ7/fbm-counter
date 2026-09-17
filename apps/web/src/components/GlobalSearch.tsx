import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { SearchHitDto } from '@fbm/shared';
import { Spinner } from './ui/Spinner';
import { cn } from '../lib/cn';
import { searchGlobal } from '../services/search';

const TYPE_LABELS: Record<SearchHitDto['type'], string> = {
  project: 'Projekt',
  invoice: 'Rechnung',
  customer: 'Kunde',
  supplier: 'Lieferant',
  subcontractor: 'Nachunternehmer',
  document: 'Dokument',
  expense: 'Ausgabe',
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const listId = useId();
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

  const enabled = debounced.length >= 2;
  const searchQuery = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => searchGlobal(debounced),
    enabled,
  });

  const results = searchQuery.data?.results ?? [];

  function selectHit(hit: SearchHitDto) {
    setOpen(false);
    setQuery('');
    setDebounced('');
    navigate(hit.link);
  }

  return (
    <div className="relative min-w-0 flex-1" ref={rootRef}>
      <label className="relative block max-w-xl">
        <span className="sr-only">Globale Suche</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          role="combobox"
          aria-expanded={open && enabled}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Projekte, Rechnungen…"
          className="h-10 w-full rounded-md border border-[var(--color-border)] bg-slate-50 pr-3 pl-9 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]"
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
      </label>

      {open && enabled ? (
        <div
          id={listId}
          role="listbox"
          className="absolute right-0 left-0 z-50 mt-1 max-h-[70vh] w-full max-w-xl overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-lg sm:right-auto"
        >
          {searchQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : searchQuery.isError ? (
            <p className="px-3 py-4 text-sm text-[var(--color-danger)]">
              Suche fehlgeschlagen
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-[var(--color-muted)]">
              Keine Treffer für „{debounced}“
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((hit) => (
                <li key={`${hit.type}-${hit.id}`}>
                  <button
                    type="button"
                    role="option"
                    className={cn(
                      'flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50',
                    )}
                    onClick={() => selectHit(hit)}
                  >
                    <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase">
                      {TYPE_LABELS[hit.type]}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[var(--color-ink)]">
                        {hit.title}
                      </span>
                      {hit.subtitle ? (
                        <span className="block truncate text-xs text-[var(--color-muted)]">
                          {hit.subtitle}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
