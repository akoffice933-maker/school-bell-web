// =====================================================
// Dashboard: статус, быстрые действия, ближайшие звонки, статистика
// =====================================================

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import { scheduler } from '../lib/scheduler';
import { Icon } from '../components/Icons';
import { isPlaying, startMicRecording } from '../lib/audio';

const SHORT_DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Сейчас';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}ч ${m}м ${s}с`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DashboardPage({ onNavigate }: { onNavigate: (p: any) => void }) {
  const { state, addLog, playFile, stopPlayback, addRecording } = useApp();
  const [now, setNow] = useState(new Date());
  const [quickPickerOpen, setQuickPickerOpen] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Передаём актуальное состояние в планировщик
  useEffect(() => {
    scheduler.setState(state);
    scheduler.rebuild();
  }, [state.schedule, state.settings.activeShift, state.settings.serviceEnabled, state.holidays]);

  // Ближайшие звонки: пересчитываем каждую секунду (точное обновление обратного отсчёта)
  // и при любом изменении state (новый звонок, смена, праздник)
  const [upcoming, otherShiftUpcoming] = useMemo(() => {
    scheduler.setState(state);
    const all = scheduler.getUpcoming(10);
    const active = all.filter((item) => item.entry.shift === state.settings.activeShift).slice(0, 5);
    const other = all.filter((item) => item.entry.shift !== state.settings.activeShift).slice(0, 5);
    return [active, other] as const;
  }, [state, now]);

  const today = now.getDay();
  const todaySchedule = useMemo(
    () => state.schedule
      .filter((s) => s.dayOfWeek === today && s.shift === state.settings.activeShift)
      .sort((a, b) => a.time.localeCompare(b.time)),
    [state.schedule, today, state.settings.activeShift],
  );

  const stats = useMemo(() => {
    const todayCount = todaySchedule.length;
    const totalAudio = state.audioFiles.length;
    const recordedCount = state.audioFiles.filter((a) => a.sourceType === 'RecordedFromMic').length;
    const totalLogs = state.logs.length;
    return { todayCount, totalAudio, recordedCount, totalLogs };
  }, [todaySchedule, state.audioFiles, state.logs]);

  const handleRingNow = (entry: any) => {
    const audio = state.audioFiles.find((a) => a.id === entry.audioFileId);
    if (!audio) return;
    addLog(`🔔 Ручной запуск: ${audio.originalFileName}`, { type: 'manual', audioFileName: audio.fileName, scheduleId: entry.id });
    playFile(audio);
    setQuickPickerOpen(false);
  };

  const handleSayNow = async () => {
    addLog('🎙️ Запись голоса и мгновенное воспроизведение', { type: 'live' });
    try {
      const session = await startMicRecording();
      const ok = window.confirm('🎙️ Запись идёт...\n\nГоворите в микрофон.\n\nНажмите ОК чтобы остановить и воспроизвести.');
      const blob = await session.stop();
      if (ok) {
        const saved = await addRecording(blob, 'Срочное объявление', true);
        if (saved) {
          await playFile(saved);
          // Предлагаем сразу создать звонок в расписании
          if (window.confirm('🎉 Запись сохранена!\n\nСоздать звонок с этим аудио в расписании сейчас?')) {
            onNavigate('schedule');
            // Передадим выбранное аудио через sessionStorage
            try { sessionStorage.setItem('pendingScheduleAudioId', String(saved.id)); } catch {}
          }
        }
      }
    } catch (e: any) {
      addLog(`❌ Не удалось получить доступ к микрофону: ${e.message ?? e}`, { type: 'system' });
    }
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Hero */}
      <div className="card p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, var(--accent), transparent)' }} />
        <div className="relative grid lg:grid-cols-3 gap-6 items-center">
          <div className="lg:col-span-2">
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="text-5xl lg:text-6xl font-semibold mt-1 tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(now)}
            </div>
            <div className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              Активная смена: <span className="font-medium" style={{ color: 'var(--text)' }}>{state.settings.activeShift}</span>
              {state.holidays.find((h) => h.date === localDateKey(now))?.isBellDisabled && (
                <span className="chip chip-warning ml-2">⚠️ Праздник — звонки отключены</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setQuickPickerOpen(true)}
              className="btn btn-primary py-4 flex-col"
            >
              <Icon.Bell width={24} height={24} />
              <span className="font-semibold">Позвонить</span>
              <span className="text-[11px] opacity-80">сейчас</span>
            </button>
            <button
              onClick={handleSayNow}
              className="btn btn-secondary py-4 flex-col"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'transparent' }}
            >
              <Icon.Mic width={24} height={24} />
              <span className="font-semibold">Сказать</span>
              <span className="text-[11px] opacity-80">с микрофона</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Звонков сегодня" value={stats.todayCount} icon={<Icon.Clock />} color="#4f46e5" />
        <StatCard label="Аудиофайлов" value={stats.totalAudio} icon={<Icon.Music />} color="#10b981" />
        <StatCard label="Записей с микрофона" value={stats.recordedCount} icon={<Icon.Mic />} color="#ec4899" />
        <StatCard label="Событий в журнале" value={stats.totalLogs} icon={<Icon.FileText />} color="#f59e0b" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Upcoming */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">⏳ Ближайшие звонки</h2>
            <button onClick={() => onNavigate('schedule')} className="btn btn-ghost text-sm">
              Расписание <Icon.ChevronRight width={14} height={14} />
            </button>
          </div>
          {upcoming.length === 0 && otherShiftUpcoming.length === 0 ? (
            <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
              <Icon.Clock width={36} height={36} className="mx-auto opacity-40" />
              <div className="mt-2">Нет запланированных звонков</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Создайте расписание — звонки появятся здесь автоматически
              </div>
              <button onClick={() => onNavigate('schedule')} className="btn btn-primary mt-3">
                <Icon.Plus /> Добавить звонок
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.length === 0 ? (
                <div className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
                  <Icon.Clock width={32} height={32} className="mx-auto opacity-40" />
                  <div className="mt-2">Нет звонков для активной смены</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Выберите нужную смену в настройках или создайте новое событие
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcoming.map(({ entry, audio, when }, i) => {
                    const bt = state.bellTypes.find((b) => b.id === entry.bellTypeId);
                    const ms = when.getTime() - now.getTime();
                    const isNext = i === 0;
                    return (
                      <div
                        key={entry.id}
                        className={`p-3 rounded-lg flex items-center gap-3 ${isNext ? 'pulse-ring' : ''}`}
                        style={{ background: isNext ? 'var(--accent-soft)' : 'var(--bg-soft)' }}
                      >
                        <div
                          className="h-10 w-10 rounded-lg grid place-items-center text-xl"
                          style={{ background: bt?.color + '22', color: bt?.color }}
                        >
                          {bt?.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{bt?.name}</div>
                          <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            {audio.originalFileName} · {SHORT_DAYS[when.getDay()]} {formatTime(when)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-semibold" style={{ color: 'var(--accent)' }}>
                            {entry.time}
                          </div>
                          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            через {formatCountdown(ms)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRingNow(entry)}
                          className="btn btn-secondary p-2"
                          title="Позвонить сейчас"
                        >
                          <Icon.Play width={14} height={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {otherShiftUpcoming.length > 0 && (
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-sm font-semibold mb-2">Звонки для других смен</div>
                  <div className="space-y-2">
                    {otherShiftUpcoming.map(({ entry, audio, when }) => {
                      const bt = state.bellTypes.find((b) => b.id === entry.bellTypeId);
                      const ms = when.getTime() - now.getTime();
                      return (
                        <div key={entry.id} className="p-3 rounded-lg bg-[var(--bg-soft)] flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-lg grid place-items-center text-xl"
                            style={{ background: bt?.color + '22', color: bt?.color }}
                          >
                            {bt?.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{bt?.name}</div>
                            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {audio.originalFileName} · {SHORT_DAYS[when.getDay()]} {formatTime(when)} · {entry.shift}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-semibold" style={{ color: 'var(--accent)' }}>
                              {entry.time}
                            </div>
                            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              через {formatCountdown(ms)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Today schedule */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">📅 Сегодня ({SHORT_DAYS[today]})</h2>
          </div>
          {todaySchedule.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <div>Звонков нет</div>
              <button onClick={() => onNavigate('schedule')} className="btn btn-secondary mt-2 text-xs">
                <Icon.Plus width={12} height={12} /> Создать
              </button>
            </div>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {todaySchedule.map((entry) => {
                const bt = state.bellTypes.find((b) => b.id === entry.bellTypeId);
                const audio = state.audioFiles.find((a) => a.id === entry.audioFileId);
                return (
                  <div key={entry.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-[var(--bg-soft)]">
                    <span className="text-base">{bt?.emoji}</span>
                    <span className="font-mono text-sm font-medium">{entry.time}</span>
                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-muted)' }}>
                      {bt?.name}
                    </span>
                    <button
                      onClick={() => audio && playFile(audio)}
                      className="btn btn-ghost p-1"
                      title="Воспроизвести"
                    >
                      <Icon.Play width={12} height={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent logs */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">📋 Последние события</h2>
          <button onClick={() => onNavigate('logs')} className="btn btn-ghost text-sm">
            Все события <Icon.ChevronRight width={14} height={14} />
          </button>
        </div>
        <div className="space-y-1">
          {state.logs.slice(0, 5).map((log) => (
            <div key={log.id} className="flex items-start gap-2 py-1.5 text-sm">
              <LogTypeChip type={log.type} />
              <span style={{ color: 'var(--text-muted)' }} className="font-mono text-xs whitespace-nowrap">
                {new Date(log.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="flex-1">{log.message}</span>
            </div>
          ))}
          {state.logs.length === 0 && (
            <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>Журнал пуст</div>
          )}
        </div>
      </div>

      {/* Quick picker modal */}
      {quickPickerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={() => setQuickPickerOpen(false)}>
          <div className="card p-5 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">🔔 Позвонить сейчас</h3>
              <button className="btn btn-ghost p-1" onClick={() => setQuickPickerOpen(false)}>
                <Icon.X width={16} height={16} />
              </button>
            </div>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
              Выберите событие из расписания — оно будет воспроизведено немедленно.
            </p>
            <div className="space-y-1">
              {todaySchedule.length === 0 ? (
                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                  На сегодня звонков нет. Создайте их в Расписании.
                </div>
              ) : (
                todaySchedule.map((entry) => {
                  const bt = state.bellTypes.find((b) => b.id === entry.bellTypeId);
                  const audio = state.audioFiles.find((a) => a.id === entry.audioFileId);
                  return (
                    <button
                      key={entry.id}
                      onClick={() => handleRingNow(entry)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-[var(--bg-soft)]"
                    >
                      <span className="text-xl">{bt?.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{bt?.name}</div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{audio?.originalFileName}</div>
                      </div>
                      <span className="font-mono text-sm">{entry.time}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div
        className="h-11 w-11 rounded-lg grid place-items-center"
        style={{ background: color + '22', color }}
      >
        {icon}
      </div>
      <div>
        <div className="text-2xl font-semibold leading-none">{value}</div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}

function LogTypeChip(props: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    bell: { label: '🔔', cls: 'chip-accent' },
    voice: { label: '🎙', cls: 'chip-warning' },
    live: { label: '📡', cls: 'chip-danger' },
    manual: { label: '▶', cls: 'chip-success' },
    system: { label: '⚙', cls: '' },
  };
  const m = map[props.type] ?? map.system;
  return <span className={`chip ${m.cls}`} style={{ minWidth: 26, justifyContent: 'center' }}>{m.label}</span>;
}
