// =====================================================
// Планировщик звонков — аналог BackgroundService + System.Timers.Timer
// в C# SchoolBell.Service. Запускает события по расписанию.
// =====================================================

import type { AppState, AudioFile, LogEntry, ScheduleEntry } from './types';

type FireHandler = (entry: ScheduleEntry, audio: AudioFile) => void;
type LogHandler = (log: LogEntry) => void;

interface ScheduledTimer {
  entry: ScheduleEntry;
  fireAt: number; // Date.now() + ms
  timerId: number;
  dayKey: string; // YYYY-MM-DD когда должен сработать
}

class SchoolBellScheduler {
  private timers: ScheduledTimer[] = [];
  private fireHandler: FireHandler | null = null;
  private logHandler: LogHandler | null = null;
  private intervalId: number | null = null;
  private lastTickDay = '';
  private enabled = true;
  private appState: AppState | null = null;

  setHandlers(fire: FireHandler, log: LogHandler) {
    this.fireHandler = fire;
    this.logHandler = log;
  }

  setState(state: AppState) {
    this.appState = state;
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (v) this.rebuild();
  }

  isEnabled() {
    return this.enabled;
  }

  /** Перепланировать все события (вызывать при изменении расписания) */
  rebuild() {
    this.clear();
    if (!this.enabled || !this.appState) return;
    this.scheduleFor(new Date());
    // Каждую минуту пересчитываем (на случай, если вкладка долго свёрнута)
    this.intervalId = window.setInterval(() => this.tick(), 60_000);
  }

  private clear() {
    for (const t of this.timers) clearTimeout(t.timerId);
    this.timers = [];
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick() {
    if (!this.appState) return;
    const now = new Date();
    const today = this.dayKey(now);
    if (today !== this.lastTickDay) {
      // Новый день — пересоздать расписание
      this.lastTickDay = today;
      this.scheduleFor(now);
    }
  }

  private scheduleFor(now: Date) {
    if (!this.appState) return;
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    for (let d = 0; d < 2; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() + d);
      this.scheduleDay(date);
    }
    this.lastTickDay = this.dayKey(now);
  }

  private scheduleDay(date: Date) {
    if (!this.appState) return;
    const day = date.getDay();
    const dateStr = date.toISOString().slice(0, 10);

    // Проверка праздника
    const holiday = this.appState.holidays.find((h) => h.date === dateStr);
    if (holiday?.isBellDisabled) return;

    const todays = this.appState.schedule.filter(
      (s) => s.dayOfWeek === day && s.shift === this.appState!.settings.activeShift,
    );
    for (const entry of todays) {
      const validFrom = new Date(entry.validFrom);
      if (date < new Date(validFrom.getFullYear(), validFrom.getMonth(), validFrom.getDate())) continue;
      if (entry.validTo) {
        const validTo = new Date(entry.validTo);
        if (date > new Date(validTo.getFullYear(), validTo.getMonth(), validTo.getDate())) continue;
      }
      const [h, m] = entry.time.split(':').map(Number);
      const fireDate = new Date(date);
      fireDate.setHours(h, m, 0, 0);
      const ms = fireDate.getTime() - Date.now();
      if (ms < -1000) continue; // уже прошло
      const fireIn = Math.max(0, ms);
      const timerId = window.setTimeout(() => this.fire(entry, dateStr), fireIn);
      this.timers.push({ entry, fireAt: Date.now() + fireIn, timerId, dayKey: dateStr });
    }
  }

  private fire(entry: ScheduleEntry, dayKey: string) {
    if (!this.appState || !this.fireHandler || !this.logHandler) return;
    const audio = this.appState.audioFiles.find((a) => a.id === entry.audioFileId);
    if (!audio) return;
    const now = new Date();
    if (this.dayKey(now) !== dayKey) return; // день сменился
    const [h, m] = entry.time.split(':').map(Number);
    if (now.getHours() !== h || now.getMinutes() !== m) return; // минута другая
    this.fireHandler(entry, audio);
  }

  /** Запуск звонка вручную */
  manualFire(entry: ScheduleEntry) {
    if (!this.appState || !this.fireHandler) return;
    const audio = this.appState.audioFiles.find((a) => a.id === entry.audioFileId);
    if (audio) this.fireHandler(entry, audio);
  }

  /** Получить ближайшие N событий */
  getUpcoming(limit = 5): { entry: ScheduleEntry; audio: AudioFile; when: Date }[] {
    if (!this.appState) return [];
    const now = new Date();
    const result: { entry: ScheduleEntry; audio: AudioFile; when: Date }[] = [];
    for (let d = 0; d < 7 && result.length < limit; d++) {
      const date = new Date(now);
      date.setDate(now.getDate() + d);
      date.setHours(0, 0, 0, 0);
      const day = date.getDay();
      const dateStr = date.toISOString().slice(0, 10);
      const holiday = this.appState.holidays.find((h) => h.date === dateStr);
      if (holiday?.isBellDisabled) continue;
      const todays = this.appState.schedule.filter(
        (s) => s.dayOfWeek === day && s.shift === this.appState!.settings.activeShift,
      );
      for (const entry of todays) {
        const [h, m] = entry.time.split(':').map(Number);
        const when = new Date(date);
        when.setHours(h, m, 0, 0);
        if (when < now) continue;
        const audio = this.appState.audioFiles.find((a) => a.id === entry.audioFileId);
        if (!audio) continue;
        result.push({ entry, audio, when });
        if (result.length >= limit) break;
      }
    }
    return result.sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, limit);
  }

  private dayKey(d: Date) {
    return d.toISOString().slice(0, 10);
  }
}

export const scheduler = new SchoolBellScheduler();
