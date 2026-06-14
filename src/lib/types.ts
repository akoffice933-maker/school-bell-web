// =====================================================
// Типы данных, повторяющие сущности из C# моделей EF Core
// =====================================================

export type SourceType = 'Uploaded' | 'RecordedFromMic' | 'BuiltIn';

/** Тип сущности: обычное аудио или TTS (синтез речи) */
export type AudioKind = 'audio' | 'tts';

export type BellCategory = 'Bell' | 'VoiceAnnouncement' | 'Special';

export interface AudioFile {
  id: number;
  fileName: string;            // Уникальное имя в библиотеке, напр. "Bell_start.mp3"
  originalFileName: string;    // Оригинальное имя от пользователя
  filePath: string;            // objectURL (в браузере) или путь
  durationSeconds: number;
  volume: number;              // 0.0 .. 1.0
  sourceType: SourceType;
  /** 'audio' — обычное аудио, 'tts' — синтез речи (text хранится в ttsText) */
  kind: AudioKind;
  /** Текст для TTS-озвучки (используется только если kind === 'tts') */
  ttsText: string;
  dateUploaded: string;        // ISO
  transcriptText: string;      // текстовая заметка
  isInUse: boolean;            // используется в расписании
  // Бинарные данные хранятся отдельно в IndexedDB (для kind === 'audio')
  blobKey?: string;
}

export interface BellType {
  id: number;
  name: string;                // "Начало урока"
  category: BellCategory;
  emoji: string;
  color: string;               // CSS color
}

export interface ScheduleEntry {
  id: number;
  dayOfWeek: number;           // 0=Вс, 1=Пн ... 6=Сб
  time: string;                // "HH:MM"
  endTime?: string | null;     // "HH:MM" (опционально)
  bellTypeId: number;
  audioFileId: number;
  shift: string;               // "Первая смена" / "Вторая смена"
  isRecurring: boolean;
  validFrom: string;           // ISO date
  validTo: string | null;
}

export interface Holiday {
  id: number;
  date: string;                // YYYY-MM-DD
  name: string;
  isBellDisabled: boolean;
  customScheduleJson: string | null;
}

export interface Settings {
  id: number;
  serviceEnabled: boolean;
  audioDeviceId: string;       // для getUserMedia constraints
  defaultVolume: number;
  theme: 'light' | 'dark';
  passwordHash: string | null;
  activeShift: string;
  showNotifications: boolean;
}

export interface MicRecording {
  id: number;
  audioFileId: number;
  recordingDate: string;
  durationSeconds: number;
  transcriptText: string;
  wasLiveBroadcast: boolean;
}

export interface LogEntry {
  id: number;
  timestamp: string;
  scheduleId: number | null;
  audioFileName: string;
  message: string;
  type: 'bell' | 'voice' | 'live' | 'manual' | 'system';
}

export interface AppState {
  audioFiles: AudioFile[];
  bellTypes: BellType[];
  schedule: ScheduleEntry[];
  holidays: Holiday[];
  settings: Settings;
  micRecordings: MicRecording[];
  logs: LogEntry[];
}
