import { useCallback } from 'react';
import { useStore } from './store';
import { resolveLang, tr, type Key } from './i18n';

/** Translation hook: re-renders when the language changes */
export function useT() {
  const lang = useStore((s) => s.settings.language);
  const l = resolveLang(lang);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((key: Key, vars?: Record<string, string | number>) => tr(key, vars, l), [l]);
}

export function useLang() {
  return resolveLang(useStore((s) => s.settings.language));
}
