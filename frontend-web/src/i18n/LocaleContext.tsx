'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { translations, LOCALES, LOCALE_LABELS, type Locale } from './translations';

type Vars = Record<string, string | number>;
export type TFunction = (key: string, vars?: Vars) => string;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunction;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale;
    if (saved && LOCALES.includes(saved)) {
      setLocaleState(saved);
      return;
    }
    const browserLang = navigator.language.split('-')[0] as Locale;
    if (LOCALES.includes(browserLang)) {
      setLocaleState(browserLang);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem('locale', l);
    setLocaleState(l);
  }, []);

  const t = useCallback<TFunction>(
    (key, vars) => {
      const dict = translations[locale] as Record<string, string>;
      const fallback = translations.en as Record<string, string>;
      const template = dict[key] ?? fallback[key] ?? key;
      return interpolate(template, vars);
    },
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className={
        className ??
        'px-2 py-1 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500'
      }
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  );
}
