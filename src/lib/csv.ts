// =====================================================
// CSV-импорт/экспорт расписания
// Простой парсер: запятая как разделитель, "..." для экранирования запятых/переносов
// =====================================================

import type { ScheduleEntry, BellType } from './types';

const DAY_MAP_RU: Record<string, number> = {
  'понедельник': 1, 'пн': 1, 'monday': 1,
  'вторник': 2, 'вт': 2, 'tuesday': 2,
  'среда': 3, 'ср': 3, 'wednesday': 3,
  'четверг': 4, 'чт': 4, 'thursday': 4,
  'пятница': 5, 'пт': 5, 'friday': 5,
  'суббота': 6, 'сб': 6, 'saturday': 6,
  'воскресенье': 0, 'вс': 0, 'sunday': 0,
};

function escapeCsvField(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',' || c === ';') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function exportScheduleToCSV(schedule: ScheduleEntry[], bellTypes: BellType[]): string {
  const typeById = new Map(bellTypes.map((b) => [b.id, b]));
  const header = ['День', 'Время', 'Тип', 'Смена', 'Повтор', 'Действует с', 'Действует по', 'ID аудио'];
  const lines: string[] = [header.map(escapeCsvField).join(',')];
  const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  for (const s of schedule) {
    const bt = typeById.get(s.bellTypeId);
    const row = [
      dayNames[s.dayOfWeek] ?? String(s.dayOfWeek),
      s.time,
      bt ? bt.name : `#${s.bellTypeId}`,
      s.shift,
      s.isRecurring ? 'да' : 'нет',
      s.validFrom,
      s.validTo ?? '',
      String(s.audioFileId),
    ];
    lines.push(row.map(escapeCsvField).join(','));
  }
  return lines.join('\n');
}

export interface CSVImportResult {
  ok: boolean;
  entries: ScheduleEntry[];
  errors: string[];
  /** Следующий доступный ID */
  nextId: number;
}

export function importScheduleFromCSV(
  csv: string,
  bellTypes: BellType[],
  nextId: number,
): CSVImportResult {
  const errors: string[] = [];
  const entries: ScheduleEntry[] = [];
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { ok: false, entries: [], errors: ['Файл пустой'], nextId };

  // Заголовок может быть в 1-й строке (содержит "День" или "Время")
  let dataLines = lines;
  if (/день|время/i.test(lines[0])) dataLines = lines.slice(1);

  const typeByName = new Map<string, number>(bellTypes.map((b) => [b.name.toLowerCase(), b.id]));
  let currentId = nextId;
  for (let i = 0; i < dataLines.length; i++) {
    const cells = parseCsvLine(dataLines[i]).map((c) => c.trim());
    if (cells.length < 3) {
      errors.push(`Строка ${i + 2}: меньше 3 колонок`);
      continue;
    }
    const [dayStr, timeStr, typeStr, shiftStr, repeatStr, fromStr, toStr, audioIdStr] = cells;
    const dayKey = (dayStr || '').toLowerCase();
    const dayOfWeek = DAY_MAP_RU[dayKey];
    if (dayOfWeek === undefined) {
      // Попробуем распарсить как число
      const n = parseInt(dayStr, 10);
      if (!isNaN(n) && n >= 0 && n <= 6) {
        // ok
      } else {
        errors.push(`Строка ${i + 2}: неизвестный день "${dayStr}"`);
        continue;
      }
    }
    if (!/^\d{1,2}:\d{2}$/.test(timeStr || '')) {
      errors.push(`Строка ${i + 2}: некорректное время "${timeStr}"`);
      continue;
    }
    let bellTypeId = typeByName.get((typeStr || '').toLowerCase());
    if (bellTypeId === undefined) {
      const n = parseInt(typeStr, 10);
      if (!isNaN(n)) bellTypeId = n;
      else {
        errors.push(`Строка ${i + 2}: неизвестный тип "${typeStr}"`);
        continue;
      }
    }
    const shift = shiftStr && shiftStr.length > 0 ? shiftStr : 'Первая смена';
    const isRecurring = /^(да|yes|y|1|true|ежедневно)/i.test(repeatStr || '');
    const validFrom = (fromStr && /^\d{4}-\d{2}-\d{2}$/.test(fromStr)) ? fromStr : new Date().toISOString().slice(0, 10);
    const validTo = toStr && /^\d{4}-\d{2}-\d{2}$/.test(toStr) ? toStr : null;
    const audioFileId = parseInt(audioIdStr, 10) || 1;
    const dayFinal = dayOfWeek !== undefined ? dayOfWeek : parseInt(dayStr, 10);
    entries.push({
      id: currentId++,
      dayOfWeek: dayFinal,
      time: timeStr,
      bellTypeId,
      audioFileId,
      shift,
      isRecurring,
      validFrom,
      validTo,
    });
  }
  return { ok: errors.length === 0, entries, errors, nextId: currentId };
}

/** Скачивание CSV-строки как файла */
export function downloadCsv(filename: string, csv: string) {
  // Добавим BOM для корректного открытия в Excel
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
