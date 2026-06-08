// =====================================================
// Страница «Прямой эфир»: мгновенное озвучивание с микрофона
// =====================================================

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store';
import { Icon } from '../components/Icons';
import { startLiveBroadcast } from '../lib/audio';

export function BroadcastPage() {
  const { addLog } = useApp();
  const [active, setActive] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<Awaited<ReturnType<typeof startLiveBroadcast>> | null>(null);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => () => {
    sessionRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const start = async () => {
    setError(null);
    try {
      const session = await startLiveBroadcast();
      sessionRef.current = session;
      setActive(true);
      setDuration(0);
      startRef.current = Date.now();
      timerRef.current = window.setInterval(() => setDuration((Date.now() - startRef.current) / 1000), 100);
      addLog('📡 Прямой эфир включён', { type: 'live' });
    } catch (e: any) {
      const msg = e.message ?? String(e);
      setError(msg);
      addLog(`❌ Не удалось запустить прямой эфир: ${msg}`, { type: 'system' });
    }
  };

  const stop = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setActive(false);
    addLog(`📡 Прямой эфир выключен (длительность: ${duration.toFixed(1)}с)`, { type: 'live' });
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="card p-6 lg:p-10 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #ef4444, transparent)' }} />
        <div className="relative text-center max-w-2xl mx-auto">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 shadow-lg shadow-red-200 dark:shadow-red-900/30 mb-4">
            <Icon.Radio className="text-white" width={36} height={36} />
          </div>
          <h1 className="text-2xl font-semibold">Прямой эфир с микрофона</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Мгновенная трансляция голоса через динамики. Звук не сохраняется — используйте запись, если нужно оставить аудиофайл.
          </p>

          {/* Big live indicator */}
          <div
            className={`mt-8 h-44 w-44 mx-auto rounded-full grid place-items-center transition-all ${
              active ? 'pulse-ring' : ''
            }`}
            style={{
              background: active
                ? 'radial-gradient(circle, color-mix(in srgb, #ef4444 25%, transparent), transparent)'
                : 'var(--bg-soft)',
              color: active ? '#ef4444' : 'var(--text-muted)',
            }}
          >
            <div className="text-center">
              {active ? (
                <>
                  <div className="text-3xl font-mono font-semibold">{formatTime(duration)}</div>
                  <div className="text-xs mt-1 font-medium">● В ЭФИРЕ</div>
                </>
              ) : (
                <Icon.MicOff width={56} height={56} />
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg text-sm" style={{ background: 'color-mix(in srgb, #ef4444 10%, transparent)', color: '#ef4444' }}>
              ⚠️ {error}
            </div>
          )}

          <div className="mt-6 flex justify-center gap-3">
            {!active ? (
              <button onClick={start} className="btn btn-danger px-6 py-3 text-base">
                <Icon.Mic width={20} height={20} /> Включить микрофон
              </button>
            ) : (
              <button onClick={stop} className="btn btn-secondary px-6 py-3 text-base">
                <Icon.MicOff width={20} height={20} /> Выключить
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card p-5 text-sm" style={{ color: 'var(--text-muted)' }}>
        <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--text)' }}>💡 Как это работает</h3>
        <ul className="space-y-1.5 ml-4 list-disc">
          <li>Нажмите «Включить микрофон» и разрешите доступ в браузере.</li>
          <li>Говорите — звук сразу идёт в динамики (с низкой задержкой через Web Audio API).</li>
          <li>Для сохранения оповещения используйте страницу «Запись с микрофона».</li>
          <li>Активация логируется — запись появится в журнале событий.</li>
        </ul>
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
