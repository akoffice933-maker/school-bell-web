// =====================================================
// Страница «Запись с микрофона»: запись, прослушивание, заметки
// =====================================================

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store';
import { Icon } from '../components/Icons';
import { startMicRecording, formatDuration, playAudioFile, stopAudio, createLevelMeter, type LevelMeter } from '../lib/audio';

export function RecorderPage() {
  const { state, addRecording, addLog } = useApp();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [playing, setPlaying] = useState<number | null>(null);
  const sessionRef = useRef<Awaited<ReturnType<typeof startMicRecording>> | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => () => {
    sessionRef.current?.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const start = async () => {
    try {
      const session = await startMicRecording();
      sessionRef.current = session;
      setRecording(true);
      setElapsed(0);
      startTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => setElapsed((Date.now() - startTimeRef.current) / 1000), 100);
      addLog('🎙️ Запись с микрофона начата', { type: 'voice' });
    } catch (e: any) {
      addLog(`❌ Ошибка доступа к микрофону: ${e.message ?? e}`, { type: 'system' });
      alert('Не удалось получить доступ к микрофону. Проверьте разрешения в браузере.');
    }
  };

  const stop = async () => {
    if (!sessionRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
    const blob = await sessionRef.current.stop();
    sessionRef.current = null;
    if (blob.size < 1000) {
      addLog('⚠️ Запись слишком короткая, не сохранена', { type: 'voice' });
      return;
    }
    await addRecording(blob, transcript, false);
    setTranscript('');
  };

  const cancel = () => {
    if (!sessionRef.current) return;
    sessionRef.current.cancel();
    sessionRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
    setElapsed(0);
    addLog('⏹ Запись с микрофона отменена', { type: 'voice' });
  };

  const recordings = state.audioFiles
    .filter((a) => a.sourceType === 'RecordedFromMic')
    .sort((a, b) => b.dateUploaded.localeCompare(a.dateUploaded));

  const playRec = async (id: number) => {
    if (playing === id) {
      stopAudio();
      setPlaying(null);
      return;
    }
    const file = state.audioFiles.find((a) => a.id === id);
    if (!file) return;
    if (playing !== null) stopAudio();
    setPlaying(id);
    await playAudioFile(file);
    setPlaying((p) => (p === id ? null : p));
  };

  return (
    <div className="space-y-4 fade-in">
      {/* Recorder card */}
      <div className="card p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ec4899, transparent)' }} />
        <div className="relative">
          <h2 className="text-xl font-semibold mb-1">🎙️ Запись голосового сообщения</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Запишите голосовое оповещение с микрофона. Файл автоматически сохранится в библиотеку и может быть использован в расписании.
          </p>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Visualization + controls */}
            <div className="flex flex-col items-center justify-center p-6 rounded-xl" style={{ background: 'var(--bg-soft)' }}>
              <div
                className={`h-32 w-32 rounded-full grid place-items-center mb-4 transition-all ${
                  recording ? 'pulse-ring' : ''
                }`}
                style={{
                  background: recording ? 'color-mix(in srgb, #ef4444 20%, var(--bg-elev))' : 'var(--bg-elev)',
                  color: recording ? '#ef4444' : 'var(--text-muted)',
                }}
              >
                {recording ? (
                  <div className="text-4xl font-mono font-semibold">{formatDuration(elapsed)}</div>
                ) : (
                  <Icon.Mic width={56} height={56} />
                )}
              </div>

              {recording ? (
                <div className="flex items-center gap-2 w-full max-w-xs">
                  <span className="led led-on flex-shrink-0" style={{ color: '#ef4444' }} />
                  <span className="text-sm font-medium whitespace-nowrap" style={{ color: '#ef4444' }}>Идёт запись</span>
                  <LevelBar stream={sessionRef.current?.stream ?? null} />
                </div>
              ) : (
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Готов к записи</span>
              )}

              <div className="flex gap-2 mt-4">
                {!recording ? (
                  <button onClick={start} className="btn btn-primary">
                    <Icon.Mic width={16} height={16} /> Начать запись
                  </button>
                ) : (
                  <>
                    <button onClick={stop} className="btn btn-danger">
                      <Icon.Stop width={16} height={16} /> Остановить
                    </button>
                    <button onClick={cancel} className="btn btn-secondary">Отмена</button>
                  </>
                )}
              </div>
            </div>

            {/* Transcript */}
            <div>
              <label className="block text-sm font-medium mb-2">Текстовая заметка (что было сказано)</label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Например: 'Срочное собрание в актовом зале через 5 минут'"
                rows={6}
                disabled={recording}
              />
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Заметка сохранится вместе с аудиофайлом и поможет вспомнить содержание.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recordings list */}
      <div className="card p-5">
        <h2 className="font-semibold text-lg mb-3">📚 Мои записи ({recordings.length})</h2>
        {recordings.length === 0 ? (
          <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
            <Icon.MicOff width={36} height={36} className="mx-auto opacity-40" />
            <div className="mt-2">У вас пока нет записей</div>
          </div>
        ) : (
          <div className="space-y-2">
            {recordings.map((file) => (
              <div key={file.id} className="p-3 rounded-lg flex items-center gap-3" style={{ background: 'var(--bg-soft)' }}>
                <div className="h-10 w-10 rounded-lg grid place-items-center"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  <Icon.Mic width={18} height={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{file.originalFileName}</div>
                  <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                    <span>{new Date(file.dateUploaded).toLocaleString('ru-RU')}</span>
                    <span>·</span>
                    <span>{formatDuration(file.durationSeconds)}</span>
                    {file.transcriptText && (
                      <>
                        <span>·</span>
                        <span className="truncate italic">📝 {file.transcriptText}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => playRec(file.id)}
                  className={`btn ${playing === file.id ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {playing === file.id ? <Icon.Stop width={14} height={14} /> : <Icon.Play width={14} height={14} />}
                  {playing === file.id ? 'Стоп' : 'Слушать'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Визуализатор уровня сигнала с микрофона (RMS) */
function LevelBar({ stream }: { stream: MediaStream | null }) {
  const [level, setLevel] = useState(0);
  const meterRef = useRef<LevelMeter | null>(null);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!stream) { setLevel(0); return; }
    let active = true;
    try {
      meterRef.current = createLevelMeter(stream);
      const tick = () => {
        if (!active) return;
        setLevel(meterRef.current?.getLevel() ?? 0);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {}
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      meterRef.current?.stop();
      meterRef.current = null;
    };
  }, [stream]);
  const pct = Math.min(100, Math.round(level * 200));
  const color = level > 0.4 ? '#ef4444' : level > 0.15 ? '#f59e0b' : '#10b981';
  return (
    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="h-full transition-all duration-75" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
