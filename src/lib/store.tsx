// =====================================================
// Глобальное состояние приложения (React Context + useReducer)
// Аналог DI-контейнера в C# — единая точка доступа к сервисам.
// =====================================================

import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode, type Dispatch } from 'react';
import type {
  AppState, AudioFile, ScheduleEntry, Holiday, LogEntry, MicRecording, Settings, BellType,
} from './types';
import { loadState, saveState, createInitialState } from './storage';
import {
  ensureBuiltInAudio, stopAny, playAnyFile, ingestUploadedFile, ingestRecordedBlob, validateAudioFile,
} from './audio';
import { scheduler } from './scheduler';
import { deleteAudioBlob } from './storage';

type Action =
  | { type: 'INIT'; state: AppState }
  | { type: 'ADD_AUDIO'; file: AudioFile }
  | { type: 'UPDATE_AUDIO'; file: AudioFile }
  | { type: 'DELETE_AUDIO'; id: number }
  | { type: 'ADD_SCHEDULE'; entry: ScheduleEntry }
  | { type: 'UPDATE_SCHEDULE'; entry: ScheduleEntry }
  | { type: 'DELETE_SCHEDULE'; id: number }
  | { type: 'ADD_HOLIDAY'; holiday: Holiday }
  | { type: 'UPDATE_HOLIDAY'; holiday: Holiday }
  | { type: 'DELETE_HOLIDAY'; id: number }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'ADD_LOG'; log: LogEntry }
  | { type: 'CLEAR_LOGS' }
  | { type: 'ADD_MIC_RECORDING'; rec: MicRecording }
  | { type: 'IMPORT'; state: AppState }
  | { type: 'BULK_UPDATE_SCHEDULE'; entries: ScheduleEntry[] };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INIT': return action.state;
    case 'ADD_AUDIO': {
      const updated = { ...state, audioFiles: [...state.audioFiles, action.file] };
      recomputeInUse(updated);
      return updated;
    }
    case 'UPDATE_AUDIO': {
      const updated = {
        ...state,
        audioFiles: state.audioFiles.map((a) => (a.id === action.file.id ? action.file : a)),
      };
      recomputeInUse(updated);
      return updated;
    }
    case 'DELETE_AUDIO': {
      const updated = {
        ...state,
        audioFiles: state.audioFiles.filter((a) => a.id !== action.id),
      };
      recomputeInUse(updated);
      return updated;
    }
    case 'ADD_SCHEDULE': {
      const updated = { ...state, schedule: [...state.schedule, action.entry] };
      recomputeInUse(updated);
      return updated;
    }
    case 'UPDATE_SCHEDULE': {
      const updated = {
        ...state,
        schedule: state.schedule.map((s) => (s.id === action.entry.id ? action.entry : s)),
      };
      recomputeInUse(updated);
      return updated;
    }
    case 'DELETE_SCHEDULE':
      return { ...state, schedule: state.schedule.filter((s) => s.id !== action.id) };
    case 'BULK_UPDATE_SCHEDULE':
      return { ...state, schedule: action.entries };
    case 'ADD_HOLIDAY':
      return { ...state, holidays: [...state.holidays, action.holiday] };
    case 'UPDATE_HOLIDAY':
      return {
        ...state,
        holidays: state.holidays.map((h) => (h.id === action.holiday.id ? action.holiday : h)),
      };
    case 'DELETE_HOLIDAY':
      return { ...state, holidays: state.holidays.filter((h) => h.id !== action.id) };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'ADD_LOG':
      return { ...state, logs: [action.log, ...state.logs].slice(0, 500) };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    case 'ADD_MIC_RECORDING':
      return { ...state, micRecordings: [action.rec, ...state.micRecordings] };
    case 'IMPORT': {
      const updated = { ...state, ...action.state };
      recomputeInUse(updated);
      return updated;
    }
    default:
      return state;
  }
}

function recomputeInUse(state: AppState) {
  const used = new Set(state.schedule.map((s) => s.audioFileId));
  state.audioFiles.forEach((a) => (a.isInUse = used.has(a.id)));
}

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  // Хелперы
  addLog: (message: string, opts?: { type?: LogEntry['type']; scheduleId?: number | null; audioFileName?: string }) => void;
  uploadAudio: (file: File, transcript?: string) => Promise<AudioFile | null>;
  addRecording: (blob: Blob, transcript: string, wasLive: boolean) => Promise<AudioFile | null>;
  playFile: (file: AudioFile, onEnded?: () => void) => Promise<void>;
  stopPlayback: () => void;
  rebuildSchedule: () => void;
  deleteAudio: (id: number) => Promise<void>;
  genIds: {
    audio: () => number;
    schedule: () => number;
    holiday: () => number;
    mic: () => number;
  };
  // Расширенный API
  validateAndUpload: (file: File, transcript?: string) => Promise<AudioFile | null>;
  applyTemplate: (templateId: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as unknown as AppState, () => createInitialState());
  const initialized = useRef(false);
  const logCounter = useRef(1000);
  const audioIdCounter = useRef(10000);
  const scheduleIdCounter = useRef(10000);
  const holidayIdCounter = useRef(1000);
  const micIdCounter = useRef(1000);

  // Инициализация (загрузка из localStorage + подготовка встроенных аудио)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      const saved = loadState();
      let initial: AppState = saved ?? createInitialState();
      initial = { ...initial, audioFiles: await ensureBuiltInAudio(initial.audioFiles) };
      dispatch({ type: 'INIT', state: initial });
    })();
  }, []);

  // Применение темы
  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [state.settings.theme]);

  // Сохранение состояния в localStorage при каждом изменении
  useEffect(() => {
    if (initialized.current) saveState(state);
  }, [state]);

  // Передача состояния в планировщик и настройка обработчиков
  useEffect(() => {
    scheduler.setState(state);
    scheduler.setHandlers(
      (entry, audio) => {
        const bellType: BellType | undefined = state.bellTypes.find((b: BellType) => b.id === entry.bellTypeId);
        const type: LogEntry['type'] = bellType?.category === 'VoiceAnnouncement' ? 'voice' : 'bell';
        const log: LogEntry = {
          id: ++logCounter.current,
          timestamp: new Date().toISOString(),
          scheduleId: entry.id,
          audioFileName: audio.fileName,
          message: `${bellType?.emoji ?? '🔔'} ${bellType?.name ?? 'Звонок'} — ${entry.time}`,
          type,
        };
        dispatch({ type: 'ADD_LOG', log });
        showNotification(log.message);
        // Поддержка TTS (kind === 'tts') и обычного аудио
        void playAnyFile(audio).catch((e: any) => {
          addLog(`❌ Не удалось запустить звук: ${e?.message ?? e}`, { type: 'system', scheduleId: entry.id, audioFileName: audio.fileName });
        });
      },
      () => {},
    );
    scheduler.setEnabled(state.settings.serviceEnabled);
  }, [state]);

  // Следующее событие для быстрого обновления UI
  useEffect(() => {
    const id = setInterval(() => {
      // форсируем rerender через диспатч лога только при смене минуты
      // (для таймера обратного отсчёта)
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const addLog: AppContextValue['addLog'] = (message, opts) => {
    const log: LogEntry = {
      id: ++logCounter.current,
      timestamp: new Date().toISOString(),
      scheduleId: opts?.scheduleId ?? null,
      audioFileName: opts?.audioFileName ?? '',
      message,
      type: opts?.type ?? 'system',
    };
    dispatch({ type: 'ADD_LOG', log });
  };

  const uploadAudio: AppContextValue['uploadAudio'] = async (file, transcript) => {
    try {
      const af = await ingestUploadedFile(file, transcript);
      af.id = ++audioIdCounter.current;
      dispatch({ type: 'ADD_AUDIO', file: af });
      addLog(`📁 Загружен аудиофайл: ${af.originalFileName}`, { type: 'system', audioFileName: af.fileName });
      return af;
    } catch (e: any) {
      console.error(e);
      addLog(`❌ Ошибка загрузки: ${e.message ?? e}`, { type: 'system' });
      return null;
    }
  };

  const addRecording: AppContextValue['addRecording'] = async (blob, transcript, wasLive) => {
    try {
      const af = await ingestRecordedBlob(blob, transcript);
      af.id = ++audioIdCounter.current;
      dispatch({ type: 'ADD_AUDIO', file: af });
      const rec: MicRecording = {
        id: ++micIdCounter.current,
        audioFileId: af.id,
        recordingDate: af.dateUploaded,
        durationSeconds: af.durationSeconds,
        transcriptText: transcript,
        wasLiveBroadcast: wasLive,
      };
      dispatch({ type: 'ADD_MIC_RECORDING', rec });
      addLog(`🎙️ ${wasLive ? 'Прямой эфир завершён' : 'Голосовая запись сохранена'}: ${af.fileName}`, {
        type: wasLive ? 'live' : 'voice',
        audioFileName: af.fileName,
      });
      return af;
    } catch (e: any) {
      addLog(`❌ Ошибка записи: ${e.message ?? e}`, { type: 'system' });
      return null;
    }
  };

  const playFile: AppContextValue['playFile'] = async (file, onEnded) => {
    const label = file.kind === 'tts' ? `🔈 TTS: «${file.ttsText.slice(0, 30)}${file.ttsText.length > 30 ? '…' : ''}»` : file.originalFileName;
    addLog(`▶️ Воспроизведение: ${label}`, { type: 'manual', audioFileName: file.fileName });
    await playAnyFile(file, onEnded);
  };

  const stopPlayback: AppContextValue['stopPlayback'] = () => {
    stopAny();
    addLog('⏹ Воспроизведение остановлено', { type: 'manual' });
  };

  const rebuildSchedule = () => scheduler.rebuild();

  // Генерация ID для новых сущностей
  useEffect(() => {
    const maxA = state.audioFiles.reduce((m: number, a: AudioFile) => Math.max(m, a.id), 0);
    const maxS = state.schedule.reduce((m: number, s: ScheduleEntry) => Math.max(m, s.id), 0);
    const maxH = state.holidays.reduce((m: number, h: Holiday) => Math.max(m, h.id), 0);
    const maxR = state.micRecordings.reduce((m: number, r: MicRecording) => Math.max(m, r.id), 0);
    audioIdCounter.current = Math.max(audioIdCounter.current, maxA);
    scheduleIdCounter.current = Math.max(scheduleIdCounter.current, maxS);
    holidayIdCounter.current = Math.max(holidayIdCounter.current, maxH);
    micIdCounter.current = Math.max(micIdCounter.current, maxR);
  }, [state]);

  // Удаление аудио (с очисткой blob)
  const deleteAudio = async (id: number) => {
    const af = state.audioFiles.find((a: AudioFile) => a.id === id);
    if (af?.blobKey) {
      try { await deleteAudioBlob(af.blobKey); } catch {}
    }
    dispatch({ type: 'DELETE_AUDIO', id });
    addLog(`🗑️ Удалён аудиофайл: ${af?.originalFileName ?? id}`, { type: 'system' });
  };

  /** Валидация + загрузка аудио. Возвращает AudioFile или null. */
  const validateAndUpload: AppContextValue['validateAndUpload'] = async (file, transcript) => {
    const validation = await validateAudioFile(file);
    if (!validation.ok) {
      addLog(`❌ Аудио не принято: ${validation.error}`, { type: 'system' });
      return null;
    }
    return await uploadAudio(file, transcript);
  };

  /** Применить шаблон расписания (добавить все события из шаблона). */
  const applyTemplate: AppContextValue['applyTemplate'] = (templateId) => {
    // Импорт ленивый — не тащим в основной бандл
    import('./storage').then(({ SCHEDULE_TEMPLATES, applyScheduleTemplate }) => {
      const tpl = SCHEDULE_TEMPLATES.find((t) => t.id === templateId);
      if (!tpl) {
        addLog(`❌ Шаблон не найден: ${templateId}`, { type: 'system' });
        return;
      }
      const startId = state.schedule.reduce((m: number, s: ScheduleEntry) => Math.max(m, s.id), 0) + 1;
      const newEntries = applyScheduleTemplate(tpl, startId);
      dispatch({ type: 'BULK_UPDATE_SCHEDULE', entries: [...state.schedule, ...newEntries] });
      addLog(`📋 Применён шаблон «${tpl.name}» (${newEntries.length} событий)`, { type: 'system' });
    });
  };

  const value: AppContextValue = {
    state,
    dispatch,
    addLog,
    uploadAudio,
    addRecording,
    playFile,
    stopPlayback,
    rebuildSchedule,
    deleteAudio,
    genIds: {
      audio: () => ++audioIdCounter.current,
      schedule: () => ++scheduleIdCounter.current,
      holiday: () => ++holidayIdCounter.current,
      mic: () => ++micIdCounter.current,
    },
    validateAndUpload,
    applyTemplate,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

function showNotification(message: string) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification('Школьный звонок', { body: message, icon: '/favicon.ico' });
  } catch {}
}

export function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
