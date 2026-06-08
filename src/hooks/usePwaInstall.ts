// =====================================================
// Хук для PWA install prompt (Add to Home Screen)
// =====================================================

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export interface PwaInstallState {
  /** Можно ли показать кнопку установки */
  canInstall: boolean;
  /** Уже установлено (standalone mode) */
  isInstalled: boolean;
  /** Поддерживается ли PWA в этом браузере */
  isSupported: boolean;
  /** Запустить диалог установки */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** iOS-подсказка */
  showIosHint: boolean;
}

export function usePwaInstall(): PwaInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    // Уже установлено? (standalone режим)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsInstalled(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    // iOS-детект: Safari не поддерживает beforeinstallprompt
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandaloneIos = (window.navigator as any).standalone;
    if (isIos && !isStandaloneIos) {
      // Показываем iOS-подсказку
      setShowIosHint(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return 'unavailable';
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return choice.outcome;
    } catch {
      return 'dismissed';
    }
  };

  return {
    canInstall: !!deferredPrompt,
    isInstalled,
    isSupported: 'serviceWorker' in navigator,
    promptInstall,
    showIosHint,
  };
}
