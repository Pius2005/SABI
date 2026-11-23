import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_SETTINGS, type Lang, type TextSize, type Theme } from '@sabi/shared';
import { apiFetch, currentSession } from './api';
import {
  loadLocalSettings,
  queueSettingsPatch,
  saveLocalSettings,
  takePendingSettings,
  type LocalSettings,
} from './storage';

export interface AppSettings extends LocalSettings {}

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>, options?: { remote?: boolean }) => void;
  flushPendingSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function initialSettings(): AppSettings {
  const saved = loadLocalSettings();
  const merged: AppSettings = { ...DEFAULT_SETTINGS, ...saved };
  if (!['en', 'yo', 'ig', 'pcm'].includes(merged.preferredLang)) merged.preferredLang = 'en';
  if (!['normal', 'large', 'xl'].includes(merged.textSize)) merged.textSize = 'large';
  if (!['light', 'inverted'].includes(merged.theme)) merged.theme = 'light';
  return merged;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.dataset.text = settings.textSize;
    root.dataset.reduceMotion = String(settings.reduceMotion);
    root.style.colorScheme = settings.theme === 'inverted' ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', settings.theme === 'inverted' ? '#000000' : '#ffffff');
    saveLocalSettings(settings);
  }, [settings]);

  const flushPendingSettings = useCallback(async () => {
    if (!currentSession()) return;
    const pending = takePendingSettings();
    if (!pending) return;
    try {
      await apiFetch('/me', { method: 'PATCH', body: pending });
    } catch {
      queueSettingsPatch(pending);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => {
      void flushPendingSettings();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushPendingSettings]);

  const updateSettings = useCallback((patch: Partial<AppSettings>, options: { remote?: boolean } = {}) => {
    setSettings((previous) => {
      const next: AppSettings = { ...previous, ...patch };
      saveLocalSettings(next);
      return next;
    });
    if (options.remote !== false && currentSession()) {
      void apiFetch('/me', { method: 'PATCH', body: patch }).catch((error: unknown) => {
        if ((error as { code?: string }).code === 'NETWORK') queueSettingsPatch(patch);
      });
    }
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings, flushPendingSettings }),
    [settings, updateSettings, flushPendingSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}

export function isTextSize(value: string): value is TextSize {
  return value === 'normal' || value === 'large' || value === 'xl';
}

export function isTheme(value: string): value is Theme {
  return value === 'light' || value === 'inverted';
}

export function isLang(value: string): value is Lang {
  return value === 'en' || value === 'yo' || value === 'ig' || value === 'pcm';
}
