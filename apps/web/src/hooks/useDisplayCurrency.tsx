import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_DISPLAY_CURRENCY,
  isSupportedCurrency,
  type SupportedCurrency,
} from '@fbm/shared';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '../services/auth';
import { useAuth } from './useAuth';

type DisplayCurrencyContextValue = {
  /** Effective display currency for UI queries. */
  displayCurrency: SupportedCurrency;
  /** True while a preference save is in flight. */
  isSaving: boolean;
  setDisplayCurrency: (code: SupportedCurrency) => Promise<void>;
  /** Sync from API-resolved company default when user has no preference. */
  syncFromServer: (code: string) => void;
};

const DisplayCurrencyContext =
  createContext<DisplayCurrencyContextValue | null>(null);

export function DisplayCurrencyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const [fallback, setFallback] = useState<SupportedCurrency>(
    DEFAULT_DISPLAY_CURRENCY,
  );
  const [isSaving, setIsSaving] = useState(false);

  const preferred = user?.preferredDisplayCurrency;
  const displayCurrency: SupportedCurrency =
    preferred && isSupportedCurrency(preferred)
      ? preferred
      : fallback;

  useEffect(() => {
    if (preferred && isSupportedCurrency(preferred)) {
      setFallback(preferred);
    }
  }, [preferred]);

  const syncFromServer = useCallback(
    (code: string) => {
      if (user?.preferredDisplayCurrency) return;
      if (!isSupportedCurrency(code)) return;
      setFallback(code);
    },
    [user?.preferredDisplayCurrency],
  );

  const setDisplayCurrency = useCallback(
    async (code: SupportedCurrency) => {
      setIsSaving(true);
      try {
        const updated = await authApi.updatePreferences({
          preferredDisplayCurrency: code,
        });
        setUser(updated);
        setFallback(code);
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        await queryClient.invalidateQueries({ queryKey: ['reports'] });
      } catch (error) {
        console.error('Failed to update display currency', error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [queryClient, setUser],
  );

  const value = useMemo(
    () => ({
      displayCurrency,
      isSaving,
      setDisplayCurrency,
      syncFromServer,
    }),
    [displayCurrency, isSaving, setDisplayCurrency, syncFromServer],
  );

  return (
    <DisplayCurrencyContext.Provider value={value}>
      {children}
    </DisplayCurrencyContext.Provider>
  );
}

export function useDisplayCurrency() {
  const ctx = useContext(DisplayCurrencyContext);
  if (!ctx) {
    throw new Error(
      'useDisplayCurrency must be used within DisplayCurrencyProvider',
    );
  }
  return ctx;
}
