import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    for (const listener of listeners) listener(true);
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    for (const listener of listeners) listener(false);
  });
}

export function useInstallPrompt() {
  const [available, setAvailable] = useState(Boolean(deferredPrompt));
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const listener = (next: boolean) => setAvailable(next);
    listeners.add(listener);
    const media = window.matchMedia('(display-mode: standalone)');
    setInstalled(media.matches || Boolean((navigator as unknown as { standalone?: boolean }).standalone));
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setAvailable(false);
    if (choice.outcome === 'accepted') setInstalled(true);
    return choice.outcome === 'accepted';
  };

  return { available, installed, install };
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is best effort */
    });
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as unknown as { standalone?: boolean }).standalone)
  );
}
