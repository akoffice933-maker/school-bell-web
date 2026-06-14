// =====================================================
// Layout: боковая навигация, верхняя панель, основная область
// =====================================================

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useApp } from '../lib/store';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { Icon } from './Icons';
import { ensureAudioContextReady, isPlaying, isTTSSpeaking } from '../lib/audio';

export type PageId = 'dashboard' | 'schedule' | 'library' | 'recorder' | 'broadcast' | 'logs' | 'settings';

interface NavItem {
  id: PageId;
  label: string;
  icon: (p: any) => ReactNode;
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Главная', icon: Icon.Home },
  { id: 'schedule', label: 'Расписание', icon: Icon.Calendar },
  { id: 'library', label: 'Библиотека аудио', icon: Icon.Music },
  { id: 'recorder', label: 'Запись с микрофона', icon: Icon.Mic },
  { id: 'broadcast', label: 'Прямой эфир', icon: Icon.Radio },
  { id: 'logs', label: 'Журнал событий', icon: Icon.FileText },
  { id: 'settings', label: 'Настройки', icon: Icon.Settings },
];

export function Layout({
  current, onNavigate, children,
}: {
  current: PageId;
  onNavigate: (p: PageId) => void;
  children: ReactNode;
}) {
  const { state, dispatch, stopPlayback } = useApp();
  const pwa = usePwaInstall();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [iosDismissed, setIosDismissed] = useState(false);
  const audioActive = useAudioActive();

  useEffect(() => {
    const unlock = () => {
      void ensureAudioContextReady().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return (
    <div className="flex h-full" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside
        className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
          fixed lg:static z-40 inset-y-0 left-0 w-64 transition-transform
          flex flex-col border-r`}
        style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
      >
        <div className="px-5 py-5 flex items-center gap-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center shadow-md shadow-indigo-200 dark:shadow-indigo-900/40">
            <Icon.Bell className="text-white" width={20} height={20} />
          </div>
          <div>
            <div className="font-semibold leading-tight">Школьный звонок</div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              v1.0 · Web Edition
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((n) => {
            const Active = current === n.id;
            const Ico = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => { onNavigate(n.id); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  Active ? 'shadow-sm' : ''
                }`}
                style={{
                  background: Active ? 'var(--accent-soft)' : 'transparent',
                  color: Active ? 'var(--accent)' : 'var(--text)',
                }}
              >
                <Ico width={18} height={18} />
                {n.label}
                {Active && <Icon.ChevronRight className="ml-auto" width={14} height={14} />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { theme: state.settings.theme === 'dark' ? 'light' : 'dark' } })}
            className="btn btn-secondary w-full"
            title="Переключить тему"
          >
            {state.settings.theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
            {state.settings.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-14 px-4 lg:px-6 flex items-center gap-3 border-b"
          style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
        >
          <button
            className="lg:hidden btn btn-ghost p-2"
            onClick={() => setMobileOpen(true)}
            aria-label="меню"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <h1 className="text-base font-semibold flex-1 truncate">
            {NAV.find((n) => n.id === current)?.label ?? 'Школьный звонок'}
          </h1>

          {pwa.canInstall && (
            <button
              onClick={async () => {
                const r = await pwa.promptInstall();
                if (r === 'accepted') setMobileOpen(false);
              }}
              className="chip chip-accent cursor-pointer hidden sm:inline-flex"
              title="Установить как приложение"
            >
              <Icon.Download width={12} height={12} />
              Установить
            </button>
          )}
          {pwa.isInstalled && (
            <span className="chip hidden sm:inline-flex" title="Приложение установлено">
              <Icon.Check width={12} height={12} />
              Установлено
            </span>
          )}
          {audioActive && (
            <button
              onClick={stopPlayback}
              className="chip chip-danger cursor-pointer hidden sm:inline-flex"
              title="Остановить текущее аудио"
            >
              <Icon.Stop width={12} height={12} />
              Стоп аудио
            </button>
          )}
          <ServiceStatusBadge />
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>

      {/* iOS-подсказка: открой «Поделиться» → «На экран Домой» */}
      {pwa.showIosHint && !pwa.isInstalled && !iosDismissed && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm card p-4 fade-in shadow-2xl"
          style={{ background: 'var(--bg-elev)' }}
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center flex-shrink-0">
              <Icon.Bell className="text-white" width={18} height={18} />
            </div>
            <div className="flex-1 text-sm">
              <div className="font-semibold mb-1">Установить как приложение</div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Нажмите <b>«Поделиться»</b> в Safari, затем выберите <b>«На экран Домой»</b>.
              </p>
            </div>
            <button
              onClick={() => setIosDismissed(true)}
              className="btn btn-ghost p-1"
              aria-label="закрыть"
            >
              <Icon.X width={14} height={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceStatusBadge() {
  const { state, dispatch } = useApp();
  const active = state.settings.serviceEnabled;
  return (
    <button
      onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { serviceEnabled: !active } })}
      className={`chip ${active ? 'chip-success' : 'chip-danger'} cursor-pointer`}
      title={active ? 'Служба работает. Кликните для остановки' : 'Служба остановлена. Кликните для запуска'}
    >
      <span style={{ color: active ? 'var(--success)' : 'var(--danger)' }}>
        <span className={`led ${active ? 'led-on' : 'led-off'}`} />
      </span>
      {active ? 'Служба запущена' : 'Служба остановлена'}
    </button>
  );
}

function useAudioActive() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(isPlaying() || isTTSSpeaking());
    sync();
    const id = window.setInterval(sync, 200);
    return () => clearInterval(id);
  }, []);

  return active;
}
