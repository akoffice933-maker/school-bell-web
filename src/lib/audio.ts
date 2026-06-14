// =====================================================
// Аудио-движок: воспроизведение, запись, прямой эфир.
// Аналог SchoolBell.Audio на NAudio (WaveOutEvent, WaveInEvent, BufferedWaveProvider)
// =====================================================

import type { AudioFile } from './types';
import { saveAudioBlob, loadAudioBlob } from './storage';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new Ctx();
  }
  return audioContext;
}

export async function ensureAudioContextReady(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

// ---------- Синтез встроенных звонков (заменяет MP3) ----------

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
}

function generateBellTone(frequency: number, durationSec: number, sampleRate = 44100, decay = 5): Float32Array {
  const numSamples = Math.floor(durationSec * sampleRate);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Колокольчик: основная частота + гармоники + затухание
    const env = Math.exp(-decay * t);
    const s =
      Math.sin(2 * Math.PI * frequency * t) * 0.6 +
      Math.sin(2 * Math.PI * frequency * 2 * t) * 0.25 +
      Math.sin(2 * Math.PI * frequency * 3 * t) * 0.15;
    samples[i] = s * env * 0.6;
  }
  return samples;
}

async function buildBuiltInTone(kind: 'break' | 'start' | 'end'): Promise<Blob> {
  // Чуть разные частоты/длительности для разных типов
  const cfg = {
    break: { freq: 880, dur: 1.6, decay: 4.5 },
    start: { freq: 660, dur: 1.4, decay: 4.0 },
    end: { freq: 550, dur: 1.4, decay: 4.0 },
  }[kind];
  const samples = generateBellTone(cfg.freq, cfg.dur, 44100, cfg.decay);
  return encodeWAV(samples, 44100);
}

export async function ensureBuiltInAudio(audioFiles: AudioFile[]): Promise<AudioFile[]> {
  const updated: AudioFile[] = [];
  for (const af of audioFiles) {
    if (af.sourceType === 'BuiltIn' && af.blobKey?.startsWith('built-in:')) {
      if (!(await loadAudioBlob(af.blobKey))) {
        const kind = af.blobKey.split(':')[1] as 'break' | 'start' | 'end';
        const blob = await buildBuiltInTone(kind);
        await saveAudioBlob(af.blobKey, blob);
      }
    }
    updated.push(af);
  }
  return updated;
}

// ---------- Декодирование аудио из блоба ----------

const audioCache = new Map<string, AudioBuffer>();

export async function getAudioBuffer(blobKey: string): Promise<AudioBuffer | null> {
  if (audioCache.has(blobKey)) return audioCache.get(blobKey)!;
  const blob = await loadAudioBlob(blobKey);
  if (!blob) return null;
  const ctx = getAudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    audioCache.set(blobKey, buffer);
    return buffer;
  } catch (e) {
    console.error('Не удалось декодировать аудио', e);
    return null;
  }
}

// ---------- Воспроизведение ----------

let currentSource: AudioBufferSourceNode | null = null;
let currentGain: GainNode | null = null;

export async function playAudioFile(file: AudioFile, onEnded?: () => void): Promise<void> {
  if (!file.blobKey) return;
  stopAudio();
  await ensureAudioContextReady();
  const ctx = getAudioContext();
  const buffer = await getAudioBuffer(file.blobKey);
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = file.volume;
  source.connect(gain).connect(ctx.destination);
  source.onended = () => {
    if (currentSource === source) {
      currentSource = null;
      currentGain = null;
    }
    onEnded?.();
  };
  currentSource = source;
  currentGain = gain;
  source.start(0);
}

export function stopAudio(): void {
  try {
    currentSource?.stop();
  } catch {}
  currentSource = null;
  currentGain = null;
}

export function isPlaying(): boolean {
  return currentSource !== null;
}

export function setVolume(vol: number): void {
  if (currentGain) currentGain.gain.value = vol;
}

// ---------- Запись с микрофона ----------

export interface RecordingSession {
  stop: () => Promise<Blob>;
  cancel: () => void;
  stream: MediaStream;
}

export async function startMicRecording(deviceId?: string): Promise<RecordingSession> {
  const constraints: MediaStreamConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}),
    },
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const recorder = new MediaRecorder(stream, { mimeType: getSupportedMime() });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(100);

  let stopped = false;
  return {
    stream,
    stop: () =>
      new Promise<Blob>((resolve) => {
        if (stopped) {
          resolve(new Blob(chunks, { type: recorder.mimeType }));
          return;
        }
        recorder.onstop = () => {
          stopped = true;
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: recorder.mimeType }));
        };
        recorder.stop();
      }),
    cancel: () => {
      stopped = true;
      try { recorder.stop(); } catch {}
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

function getSupportedMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'audio/webm';
}

// ---------- Прямой эфир (мониторинг микрофона) ----------

export interface LiveBroadcastSession {
  stop: () => void;
  isActive: () => boolean;
}

export async function startLiveBroadcast(): Promise<LiveBroadcastSession> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = ctx.createMediaStreamSource(stream);
  const gain = ctx.createGain();
  gain.gain.value = 1.0;
  source.connect(gain).connect(ctx.destination);
  let active = true;
  return {
    stop: () => {
      if (!active) return;
      active = false;
      try { source.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
      stream.getTracks().forEach((t) => t.stop());
    },
    isActive: () => active,
  };
}

// ---------- Создание AudioFile из загруженного файла ----------

export async function ingestUploadedFile(file: File, transcript = ''): Promise<AudioFile> {
  const ctx = getAudioContext();
  const arrayBuffer = await file.arrayBuffer();
  let duration = 0;
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    duration = buffer.duration;
  } catch (e) {
    // Если не получилось декодировать (например, неподдерживаемый формат) — ставим дефолт
    duration = 0;
  }
  const blobKey = `uploaded:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  await saveAudioBlob(blobKey, file);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return {
    id: Date.now(),
    fileName: safeName.endsWith(`.${ext}`) ? safeName : `${safeName}.${ext}`,
    originalFileName: file.name,
    filePath: blobKey,
    durationSeconds: duration,
    volume: 0.8,
    sourceType: 'Uploaded',
    kind: 'audio',
    ttsText: '',
    dateUploaded: new Date().toISOString(),
    transcriptText: transcript,
    isInUse: false,
    blobKey,
  };
}

export async function ingestRecordedBlob(blob: Blob, transcript = ''): Promise<AudioFile> {
  const ctx = getAudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  let duration = 0;
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    duration = buffer.duration;
  } catch {
    duration = 0;
  }
  const blobKey = `recorded:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  await saveAudioBlob(blobKey, blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return {
    id: Date.now(),
    fileName: `Voice_${stamp}.wav`,
    originalFileName: `Голосовое сообщение ${stamp}`,
    filePath: blobKey,
    durationSeconds: duration,
    volume: 0.8,
    sourceType: 'RecordedFromMic',
    kind: 'audio',
    ttsText: '',
    dateUploaded: new Date().toISOString(),
    transcriptText: transcript,
    isInUse: false,
    blobKey,
  };
}

// ---------- Утилита: длительность mm:ss ----------

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

// ---------- TTS: синтез речи (Web Speech API) ----------

let russianVoice: SpeechSynthesisVoice | null = null;
let voicesReady = false;
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesPromise) return voicesPromise;
  voicesPromise = new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') {
      resolve([]);
      return;
    }
    const got = () => {
      const v = speechSynthesis.getVoices();
      if (v && v.length > 0) {
        voicesReady = true;
        resolve(v);
      }
    };
    got();
    if (!voicesReady) {
      speechSynthesis.onvoiceschanged = () => {
        const v = speechSynthesis.getVoices();
        voicesReady = true;
        resolve(v);
      };
      // Фолбэк через 1с
      setTimeout(() => {
        if (!voicesReady) {
          voicesReady = true;
          resolve(speechSynthesis.getVoices() ?? []);
        }
      }, 1000);
    }
  });
  return voicesPromise;
}

/** Возвращает лучший русский голос из доступных в системе */
export async function pickRussianVoice(): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadVoices();
  // Сначала ru-RU, затем ru, затем любой с ru в названии
  const exact = voices.find((v) => v.lang.toLowerCase() === 'ru-ru');
  if (exact) return exact;
  const ru = voices.find((v) => v.lang.toLowerCase().startsWith('ru'));
  if (ru) return ru;
  const byName = voices.find((v) => /русск|росси|russian/i.test(v.name));
  if (byName) return byName;
  return voices[0] ?? null;
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

export interface TTSSession {
  stop: () => void;
  promise: Promise<void>;
}

/** Произнести текст (TTS) */
export async function speakText(text: string, opts?: { volume?: number; rate?: number; pitch?: number; voiceName?: string }, onEnded?: () => void): Promise<TTSSession> {
  if (typeof speechSynthesis === 'undefined') {
    throw new Error('Web Speech API не поддерживается в этом браузере');
  }
  stopAudio();
  stopTTS();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ru-RU';
  u.volume = Math.max(0, Math.min(1, opts?.volume ?? 1));
  u.rate = opts?.rate ?? 1.0;
  u.pitch = opts?.pitch ?? 1.0;
  const voice = russianVoice ?? (await pickRussianVoice());
  if (opts?.voiceName) {
    const voices = await loadVoices();
    const found = voices.find((v) => v.name === opts.voiceName);
    if (found) u.voice = found;
    else if (voice) u.voice = voice;
  } else if (voice) {
    u.voice = voice;
  }
  const promise = new Promise<void>((resolve) => {
    u.onend = () => {
      if (currentUtterance === u) currentUtterance = null;
      onEnded?.();
      resolve();
    };
    u.onerror = () => {
      if (currentUtterance === u) currentUtterance = null;
      onEnded?.();
      resolve();
    };
  });
  currentUtterance = u;
  speechSynthesis.speak(u);
  return { stop: () => stopTTS(), promise };
}

export function stopTTS(): void {
  if (typeof speechSynthesis === 'undefined') return;
  try { speechSynthesis.cancel(); } catch {}
  currentUtterance = null;
}

export function isTTSSpeaking(): boolean {
  return typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking;
}

/** Воспроизвести AudioFile — для TTS вызывает speakText, для аудио — playAudioFile */
export async function playAnyFile(file: AudioFile, onEnded?: () => void): Promise<void> {
  if (file.kind === 'tts') {
    if (!file.ttsText.trim()) return;
    await speakText(file.ttsText, { volume: file.volume }, onEnded);
  } else {
    await playAudioFile(file, onEnded);
  }
}

export function stopAny(): void {
  stopAudio();
  stopTTS();
}

// ---------- Анализатор уровня сигнала (визуализация) ----------

export interface LevelMeter {
  /** Получить текущий уровень 0..1 (RMS) */
  getLevel: () => number;
  /** Остановить анализатор */
  stop: () => void;
}

/** Создать анализатор уровня из MediaStream */
export function createLevelMeter(stream: MediaStream): LevelMeter {
  const ctx = getAudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  let level = 0;
  let raf = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    // Лёгкое сглаживание
    level = level * 0.6 + rms * 0.4;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    getLevel: () => level,
    stop: () => {
      cancelAnimationFrame(raf);
      try { source.disconnect(); } catch {}
      try { analyser.disconnect(); } catch {}
    },
  };
}

// ---------- Тест звука (короткий сигнал) ----------

/** Проиграть короткий тестовый сигнал (используется в настройках) */
export async function playTestSound(): Promise<void> {
  const ctx = getAudioContext();
  await ensureAudioContextReady();
  stopAny();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);
  gain.gain.setValueAtTime(0.0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.55);
  await new Promise((r) => setTimeout(r, 600));
}

// ---------- Валидация аудиофайла ----------

export interface AudioValidationResult {
  ok: boolean;
  duration?: number;
  error?: string;
}

export async function validateAudioFile(file: File): Promise<AudioValidationResult> {
  // Проверка типа
  if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|webm|flac|aac)$/i.test(file.name)) {
    return { ok: false, error: 'Файл не является аудио (ожидается MP3/WAV/OGG/M4A/WebM)' };
  }
  if (file.size === 0) {
    return { ok: false, error: 'Файл пустой' };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { ok: false, error: 'Файл больше 50 МБ' };
  }
  // Проверка декодирования
  try {
    const ctx = getAudioContext();
    const buf = await file.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(buf.slice(0));
    if (audioBuf.duration < 0.1) {
      return { ok: false, error: 'Длительность слишком мала (< 0.1 с)' };
    }
    if (audioBuf.duration > 600) {
      return { ok: false, error: 'Длительность больше 10 минут' };
    }
    return { ok: true, duration: audioBuf.duration };
  } catch (e) {
    return { ok: false, error: 'Не удалось декодировать аудио (неподдерживаемый формат)' };
  }
}
