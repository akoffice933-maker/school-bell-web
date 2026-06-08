// =====================================================
// Слой хранения: IndexedDB для аудио-блобов, localStorage для остального.
// В C# оригинале это EF Core + SQLite, здесь — браузерные аналоги.
// =====================================================

import type { AppState, AudioFile, BellType, ScheduleEntry, Settings } from './types';

const DB_NAME = 'school_bell_db';
const DB_VERSION = 1;
const AUDIO_STORE = 'audio_blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function saveAudioBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    tx.objectStore(AUDIO_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAudioBlob(key: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readonly');
    const req = tx.objectStore(AUDIO_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAudioBlob(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    tx.objectStore(AUDIO_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listAudioBlobKeys(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readonly');
    const req = tx.objectStore(AUDIO_STORE).getAllKeys();
    req.onsuccess = () => resolve((req.result as IDBValidKey[]).map((k) => String(k)));
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllAudioBlobs(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    tx.objectStore(AUDIO_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- localStorage для всего остального ----------

const STATE_KEY = 'school_bell_state_v1';

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppState;
  } catch (e) {
    console.error('Ошибка чтения состояния', e);
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    // Отделяем блобы (они в IDB), оставляем только метаданные
    const slim: AppState = { ...state };
    localStorage.setItem(STATE_KEY, JSON.stringify(slim));
  } catch (e) {
    console.error('Ошибка сохранения состояния', e);
  }
}

// ---------- SHA-256 (Web Crypto API) ----------

/** Хеш строки через SHA-256 (hex). Соответствует ТЗ п.6.3. */
export async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Миграция со старого хеша (начинался с "h") на SHA-256. */
export async function migratePasswordHash(oldHash: string | null, currentPassword?: string): Promise<string | null> {
  if (!oldHash) return null;
  if (oldHash.startsWith('sha256:')) return oldHash; // уже мигрирован
  if (oldHash.startsWith('h') && currentPassword) {
    return 'sha256:' + await sha256(currentPassword);
  }
  return null;
}

// ---------- Инициализация стартовыми данными ----------

export function createInitialState(): AppState {
  const bellTypes: BellType[] = [
    { id: 1, name: 'Начало урока', category: 'Bell', emoji: '🔔', color: '#10b981' },
    { id: 2, name: 'Конец урока', category: 'Bell', emoji: '🔕', color: '#f59e0b' },
    { id: 3, name: 'Перемена', category: 'Bell', emoji: '⏰', color: '#3b82f6' },
    { id: 4, name: 'Большая перемена', category: 'Bell', emoji: '🍽️', color: '#8b5cf6' },
    { id: 5, name: 'Голосовое оповещение', category: 'VoiceAnnouncement', emoji: '🎙️', color: '#ec4899' },
    { id: 6, name: 'Спец. событие', category: 'Special', emoji: '⭐', color: '#ef4444' },
  ];

  // Стандартное расписание первой смены (Пн–Пт, 7 уроков)
  const schedule: ScheduleEntry[] = [];
  const baseFirst = [
    { t: '08:30', bt: 3 },
    { t: '08:45', bt: 1 },
    { t: '09:30', bt: 2 },
    { t: '09:40', bt: 1 },
    { t: '10:30', bt: 2 },
    { t: '10:50', bt: 1 },
    { t: '11:40', bt: 2 },
    { t: '11:50', bt: 1 },
    { t: '12:30', bt: 2 },
    { t: '12:50', bt: 1 },
    { t: '13:30', bt: 2 },
    { t: '13:50', bt: 1 },
    { t: '14:30', bt: 2 },
  ];
  let id = 1;
  for (let d = 1; d <= 5; d++) {
    for (const item of baseFirst) {
      schedule.push({
        id: id++,
        dayOfWeek: d,
        time: item.t,
        bellTypeId: item.bt,
        audioFileId: item.bt === 1 ? 2 : item.bt === 2 ? 3 : 1,
        shift: 'Первая смена',
        isRecurring: true,
        validFrom: '2024-01-01',
        validTo: null,
      });
    }
  }

  const audioFiles: AudioFile[] = [
    {
      id: 1, fileName: 'Bell_break.wav', originalFileName: 'Звонок на перемену',
      filePath: '', durationSeconds: 1.5, volume: 0.8,
      sourceType: 'BuiltIn', kind: 'audio', ttsText: '',
      dateUploaded: new Date().toISOString(),
      transcriptText: '', isInUse: true, blobKey: 'built-in:break',
    },
    {
      id: 2, fileName: 'Bell_start.wav', originalFileName: 'Звонок на урок',
      filePath: '', durationSeconds: 1.5, volume: 0.8,
      sourceType: 'BuiltIn', kind: 'audio', ttsText: '',
      dateUploaded: new Date().toISOString(),
      transcriptText: '', isInUse: true, blobKey: 'built-in:start',
    },
    {
      id: 3, fileName: 'Bell_end.wav', originalFileName: 'Звонок с урока',
      filePath: '', durationSeconds: 1.5, volume: 0.8,
      sourceType: 'BuiltIn', kind: 'audio', ttsText: '',
      dateUploaded: new Date().toISOString(),
      transcriptText: '', isInUse: true, blobKey: 'built-in:end',
    },
    {
      id: 4, fileName: 'TTS_first_lesson.wav', originalFileName: 'Озвучка: начало первого урока',
      filePath: '', durationSeconds: 3, volume: 0.9,
      sourceType: 'BuiltIn', kind: 'tts', ttsText: 'Внимание! Начинается первый урок.',
      dateUploaded: new Date().toISOString(),
      transcriptText: '', isInUse: false, blobKey: undefined,
    },
    {
      id: 5, fileName: 'TTS_big_break.wav', originalFileName: 'Озвучка: большая перемена',
      filePath: '', durationSeconds: 4, volume: 0.9,
      sourceType: 'BuiltIn', kind: 'tts', ttsText: 'Большая перемена, пятнадцать минут.',
      dateUploaded: new Date().toISOString(),
      transcriptText: '', isInUse: false, blobKey: undefined,
    },
  ];

  const settings: Settings = {
    id: 1,
    serviceEnabled: true,
    audioDeviceId: 'default',
    defaultVolume: 0.8,
    theme: 'light',
    passwordHash: null,
    activeShift: 'Первая смена',
    showNotifications: true,
  };

  return {
    audioFiles,
    bellTypes,
    schedule,
    holidays: [],
    settings,
    micRecordings: [],
    logs: [
      {
        id: 1, timestamp: new Date().toISOString(),
        scheduleId: null, audioFileName: 'Система',
        message: 'Приложение инициализировано. Загружено стартовое расписание.',
        type: 'system',
      },
    ],
  };
}

// ---------- Экспорт / Импорт (JSON) ----------

export function exportSchedule(state: AppState): string {
  const data = {
    schedule: state.schedule,
    bellTypes: state.bellTypes,
    holidays: state.holidays,
    settings: { ...state.settings, passwordHash: null },
    exportedAt: new Date().toISOString(),
    version: 1,
  };
  return JSON.stringify(data, null, 2);
}

export function importSchedule(json: string, state: AppState): AppState {
  const data = JSON.parse(json);
  return {
    ...state,
    schedule: data.schedule ?? state.schedule,
    bellTypes: data.bellTypes ?? state.bellTypes,
    holidays: data.holidays ?? state.holidays,
    settings: data.settings ? { ...state.settings, ...data.settings, passwordHash: state.settings.passwordHash } : state.settings,
  };
}

// ---------- Полный бэкап (с аудиоблобами в base64) ----------

interface AudioBlobBackup {
  key: string;
  mime: string;
  size: number;
  data: string;
}

export interface FullBackup {
  version: 2;
  exportedAt: string;
  state: Omit<AppState, 'settings'> & {
    settings: Omit<Settings, 'passwordHash'> & { passwordHash: null };
  };
  audioBlobs: AudioBlobBackup[];
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

function base64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Полный бэкап состояния + всех аудио-блобов (включая загруженные/записанные). */
export async function exportFullState(state: AppState): Promise<string> {
  const blobKeys = await listAudioBlobKeys();
  const audioBlobs: AudioBlobBackup[] = [];
  for (const key of blobKeys) {
    const blob = await loadAudioBlob(key);
    if (!blob) continue;
    audioBlobs.push({
      key,
      mime: blob.type || 'application/octet-stream',
      size: blob.size,
      data: await blobToBase64(blob),
    });
  }
  const backup: FullBackup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    state: {
      ...state,
      settings: { ...state.settings, passwordHash: null },
    },
    audioBlobs,
  };
  return JSON.stringify(backup);
}

export interface ImportFullResult {
  state: AppState;
  restoredBlobs: number;
  skippedBlobs: number;
}

/** Восстановить полный бэкап. Пароль не трогается (в бэкапе = null). */
export async function importFullState(json: string, currentState: AppState): Promise<ImportFullResult> {
  const backup = JSON.parse(json) as FullBackup;
  if (backup.version !== 2) {
    throw new Error(`Неподдерживаемая версия бэкапа: ${backup.version}`);
  }
  let restored = 0;
  let skipped = 0;
  if (Array.isArray(backup.audioBlobs)) {
    for (const ab of backup.audioBlobs) {
      try {
        const blob = base64ToBlob(ab.data, ab.mime);
        await saveAudioBlob(ab.key, blob);
        restored++;
      } catch (e) {
        skipped++;
      }
    }
  }
  const newState: AppState = {
    ...currentState,
    ...backup.state,
    settings: { ...currentState.settings, ...backup.state.settings, passwordHash: currentState.settings.passwordHash },
  };
  return { state: newState, restoredBlobs: restored, skippedBlobs: skipped };
}

// ---------- Шаблоны расписания ----------

export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  shift: 'Первая смена' | 'Вторая смена';
  /** Массив [час, минута, bellTypeId] */
  events: Array<{ time: string; bellTypeId: number; audioFileId: number }>;
  days: number[]; // 1..5 — будни
}

export const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    id: 'std-first-7',
    name: 'Стандартная 1-я смена (7 уроков)',
    description: 'Пн–Пт, начало 8:45, перемены 10 мин, 3-я перемена 15 мин',
    shift: 'Первая смена',
    days: [1, 2, 3, 4, 5],
    events: [
      { time: '08:30', bellTypeId: 3, audioFileId: 1 },
      { time: '08:45', bellTypeId: 1, audioFileId: 2 },
      { time: '09:30', bellTypeId: 2, audioFileId: 3 },
      { time: '09:40', bellTypeId: 1, audioFileId: 2 },
      { time: '10:30', bellTypeId: 2, audioFileId: 3 },
      { time: '10:50', bellTypeId: 1, audioFileId: 2 },
      { time: '11:40', bellTypeId: 2, audioFileId: 3 },
      { time: '11:50', bellTypeId: 1, audioFileId: 2 },
      { time: '12:30', bellTypeId: 2, audioFileId: 3 },
      { time: '12:50', bellTypeId: 1, audioFileId: 2 },
      { time: '13:30', bellTypeId: 2, audioFileId: 3 },
      { time: '13:50', bellTypeId: 1, audioFileId: 2 },
      { time: '14:30', bellTypeId: 2, audioFileId: 3 },
    ],
  },
  {
    id: 'std-first-6',
    name: '1-я смена (6 уроков)',
    description: 'Пн–Пт, начало 8:30, 6 уроков по 40 мин',
    shift: 'Первая смена',
    days: [1, 2, 3, 4, 5],
    events: [
      { time: '08:20', bellTypeId: 3, audioFileId: 1 },
      { time: '08:30', bellTypeId: 1, audioFileId: 2 },
      { time: '09:10', bellTypeId: 2, audioFileId: 3 },
      { time: '09:20', bellTypeId: 1, audioFileId: 2 },
      { time: '10:00', bellTypeId: 2, audioFileId: 3 },
      { time: '10:10', bellTypeId: 1, audioFileId: 2 },
      { time: '10:50', bellTypeId: 2, audioFileId: 3 },
      { time: '11:00', bellTypeId: 1, audioFileId: 2 },
      { time: '11:40', bellTypeId: 2, audioFileId: 3 },
      { time: '11:50', bellTypeId: 1, audioFileId: 2 },
      { time: '12:30', bellTypeId: 2, audioFileId: 3 },
      { time: '12:40', bellTypeId: 1, audioFileId: 2 },
      { time: '13:20', bellTypeId: 2, audioFileId: 3 },
    ],
  },
  {
    id: 'std-second-7',
    name: '2-я смена (7 уроков)',
    description: 'Пн–Пт, начало 14:00, типичная вторая смена',
    shift: 'Вторая смена',
    days: [1, 2, 3, 4, 5],
    events: [
      { time: '13:45', bellTypeId: 3, audioFileId: 1 },
      { time: '14:00', bellTypeId: 1, audioFileId: 2 },
      { time: '14:45', bellTypeId: 2, audioFileId: 3 },
      { time: '14:55', bellTypeId: 1, audioFileId: 2 },
      { time: '15:40', bellTypeId: 2, audioFileId: 3 },
      { time: '15:50', bellTypeId: 1, audioFileId: 2 },
      { time: '16:35', bellTypeId: 2, audioFileId: 3 },
      { time: '16:45', bellTypeId: 1, audioFileId: 2 },
      { time: '17:30', bellTypeId: 2, audioFileId: 3 },
      { time: '17:40', bellTypeId: 1, audioFileId: 2 },
      { time: '18:25', bellTypeId: 2, audioFileId: 3 },
      { time: '18:35', bellTypeId: 1, audioFileId: 2 },
      { time: '19:20', bellTypeId: 2, audioFileId: 3 },
    ],
  },
  {
    id: 'short-5',
    name: 'Сокращённый день (5 уроков)',
    description: 'Пн–Пт, 5 уроков по 30 мин, для сокращённых дней',
    shift: 'Первая смена',
    days: [1, 2, 3, 4, 5],
    events: [
      { time: '08:30', bellTypeId: 3, audioFileId: 1 },
      { time: '08:45', bellTypeId: 1, audioFileId: 2 },
      { time: '09:15', bellTypeId: 2, audioFileId: 3 },
      { time: '09:25', bellTypeId: 1, audioFileId: 2 },
      { time: '09:55', bellTypeId: 2, audioFileId: 3 },
      { time: '10:05', bellTypeId: 1, audioFileId: 2 },
      { time: '10:35', bellTypeId: 2, audioFileId: 3 },
      { time: '10:45', bellTypeId: 1, audioFileId: 2 },
      { time: '11:15', bellTypeId: 2, audioFileId: 3 },
    ],
  },
];

/** Создать расписание из шаблона. Возвращает новые ScheduleEntry с уникальными id. */
export function applyScheduleTemplate(
  template: ScheduleTemplate,
  startId: number,
): ScheduleEntry[] {
  const out: ScheduleEntry[] = [];
  let id = startId;
  const today = new Date().toISOString().slice(0, 10);
  for (const day of template.days) {
    for (const ev of template.events) {
      out.push({
        id: id++,
        dayOfWeek: day,
        time: ev.time,
        bellTypeId: ev.bellTypeId,
        audioFileId: ev.audioFileId,
        shift: template.shift,
        isRecurring: true,
        validFrom: today,
        validTo: null,
      });
    }
  }
  return out;
}
