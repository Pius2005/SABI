import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { LANG_TAGS, type Lang, type TranslationStatus } from '@sabi/shared';
import enStrings from '../../../../content/strings/en.json';
import yoStrings from '../../../../content/strings/yo.json';
import igStrings from '../../../../content/strings/ig.json';
import pcmStrings from '../../../../content/strings/pcm.json';
import { apiFetch } from './api';
import { APP_NAME } from './config';
import { useSettings } from './settings';

const BUNDLED = {
  en: enStrings,
  yo: yoStrings,
  ig: igStrings,
  pcm: pcmStrings,
} as unknown as Record<Lang, Record<string, string>>;

/** Interpolate {{vars}} and the app name so branding stays in APP_NAME only. */
function render(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => {
    if (name === 'app') return APP_NAME;
    return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match;
  });
}

interface UiStringsResponse {
  lang: Lang;
  strings: Record<string, string>;
  statuses: Record<string, string>;
  notice: boolean;
}

interface I18nValue {
  lang: Lang;
  strings: Record<string, string>;
  setLang: (next: Lang, options?: { remote?: boolean }) => void;
  t: (key: string, fallback?: string) => string;
  tf: (key: string, vars: Record<string, string | number>, fallback?: string) => string;
  statusFor: (key: string) => TranslationStatus | 'missing';
  notice: boolean;
  loading: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

function defaultStatuses(lang: Lang): Record<string, string> {
  if (lang === 'en') return {};
  const statuses: Record<string, string> = {};
  for (const key of Object.keys(BUNDLED[lang])) statuses[key] = 'needs_review';
  return statuses;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const [lang, setLangState] = useState<Lang>(settings.preferredLang);
  const [strings, setStrings] = useState<Record<string, string>>(BUNDLED[settings.preferredLang]);
  const [statuses, setStatuses] = useState<Record<string, string>>(defaultStatuses(settings.preferredLang));
  const [notice, setNotice] = useState(settings.preferredLang !== 'en');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (settings.preferredLang !== lang) setLangState(settings.preferredLang);
  }, [settings.preferredLang, lang]);

  useEffect(() => {
    let cancelled = false;
    setStrings(BUNDLED[lang]);
    setStatuses(defaultStatuses(lang));
    setNotice(lang !== 'en');
    setLoading(true);
    document.documentElement.lang = LANG_TAGS[lang];

    apiFetch<UiStringsResponse>(`/ui-strings/${lang}`, { auth: false })
      .then((data) => {
        if (cancelled) return;
        setStrings({ ...BUNDLED[lang], ...(data.strings ?? {}) });
        setStatuses(data.statuses ?? {});
        setNotice(Boolean(data.notice));
      })
      .catch(() => {
        if (cancelled) return;
        setStrings(BUNDLED[lang]);
        setStatuses(defaultStatuses(lang));
        setNotice(lang !== 'en');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lang]);

  const setLang = useCallback(
    (next: Lang, options: { remote?: boolean } = {}) => {
      updateSettings({ preferredLang: next }, { remote: options.remote ?? true });
    },
    [updateSettings],
  );

  const t = useCallback(
    (key: string, fallback?: string) => render(strings[key] ?? BUNDLED.en[key] ?? fallback ?? key),
    [strings],
  );

  const tf = useCallback(
    (key: string, vars: Record<string, string | number>, fallback?: string) => {
      const template = strings[key] ?? BUNDLED.en[key] ?? fallback ?? key;
      return render(template, vars);
    },
    [strings],
  );

  const statusFor = useCallback(
    (key: string): TranslationStatus | 'missing' => {
      if (!strings[key] && !BUNDLED.en[key]) return 'missing';
      const status = statuses[key] ?? (lang === 'en' ? 'approved' : 'needs_review');
      if (status === 'approved' || status === 'needs_review' || status === 'machine' || status === 'draft') {
        return status;
      }
      return 'needs_review';
    },
    [lang, statuses, strings],
  );

  const value = useMemo(
    () => ({ lang, strings, setLang, t, tf, statusFor, notice, loading }),
    [lang, strings, setLang, t, tf, statusFor, notice, loading],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

export { BUNDLED as BUNDLED_STRINGS };
