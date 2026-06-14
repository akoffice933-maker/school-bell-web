// =====================================================
// Страница «Расписание»: редактор еженедельных звонков, праздники, смены
// =====================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/store';
import type { ScheduleEntry, Holiday, AudioFile } from '../lib/types';
import { Icon } from '../components/Icons';
import { exportScheduleToCSV, importScheduleFromCSV, downloadCsv } from '../lib/csv';
import { SCHEDULE_TEMPLATES } from '../lib/storage';

const DAY_NAMES = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const DAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const SHIFTS = ['Первая смена', 'Вторая смена'];

export function SchedulePage() {
  const { state, dispatch, genIds, addLog, applyTemplate } = useApp();
  const [activeDay, setActiveDay] = useState<number>(() => new Date().getDay());
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [holidayEditing, setHolidayEditing] = useState<Holiday | null>(null);
  const [tab, setTab] = useState<'schedule' | 'holidays'>('schedule');
  const [search, setSearch] = useState('');
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Если пришли с Dashboard после записи — открыть форму с предзаполненным аудио
  useEffect(() => {
    let pendingId: number | null = null;
    try {
      const v = sessionStorage.getItem('pendingScheduleAudioId');
      if (v) {
        pendingId = Number(v);
        sessionStorage.removeItem('pendingScheduleAudioId');
      }
    } catch {}
    if (pendingId && state.audioFiles.some((a: AudioFile) => a.id === pendingId)) {
      const startTime = localTimePlusMinutes(new Date(), 60);
      setEditing({
        id: 0,
        dayOfWeek: new Date().getDay(),
        time: startTime,
        endTime: addMinutes(startTime, 45),
        bellTypeId: state.bellTypes[0]?.id ?? 1,
        audioFileId: pendingId,
        shift: state.settings.activeShift,
        isRecurring: true,
        validFrom: new Date().toISOString().slice(0, 10),
        validTo: null,
      });
    }
  }, [state.audioFiles, state.bellTypes, state.settings.activeShift]);

  // Перепланировать при изменении
  useMemo(() => {
    (window as any).__scheduleUpdate = Date.now();
  }, [state.schedule, state.holidays]);

  const daySchedule = useMemo(() => {
    const list = state.schedule.filter((s: ScheduleEntry) => s.dayOfWeek === activeDay);
    const filtered = !search
      ? list
      : list.filter((s: ScheduleEntry) => {
          const bt = state.bellTypes.find((b) => b.id === s.bellTypeId);
          const audio = state.audioFiles.find((a: AudioFile) => a.id === s.audioFileId);
          const haystack = `${s.time} ${s.endTime ?? ''} ${s.shift} ${bt?.name ?? ''} ${audio?.originalFileName ?? ''}`.toLowerCase();
          return haystack.includes(search.toLowerCase());
        });
    return filtered.sort((a: ScheduleEntry, b: ScheduleEntry) => a.time.localeCompare(b.time) || a.shift.localeCompare(b.shift));
  }, [state.schedule, activeDay, search, state.bellTypes, state.audioFiles]);

  // CSV экспорт/импорт
  const handleCsvExport = () => {
    const csv = exportScheduleToCSV(state.schedule, state.bellTypes);
    downloadCsv(`school-bell-schedule-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    addLog('📄 Расписание экспортировано в CSV', { type: 'system' });
  };
  const handleCsvImport = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    try {
      const text = await files[0].text();
      const res = importScheduleFromCSV(text, state.bellTypes, genIds.schedule() + 1000);
      dispatch({ type: 'BULK_UPDATE_SCHEDULE', entries: [...state.schedule, ...res.entries] });
      addLog(`📥 Импортировано ${res.entries.length} событий из CSV${res.errors.length ? ` (ошибок: ${res.errors.length})` : ''}`, { type: 'system' });
      if (res.errors.length) alert(`Импортировано: ${res.entries.length}\nОшибок: ${res.errors.length}\n\n${res.errors.slice(0, 5).join('\n')}`);
    } catch (e: any) {
      alert(`Ошибка CSV: ${e.message ?? e}`);
    }
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const handleNew = () => {
    const startTime = '09:00';
    setEditing({
      id: 0,
      dayOfWeek: activeDay,
      time: startTime,
      endTime: addMinutes(startTime, 45),
      bellTypeId: state.bellTypes[0]?.id ?? 1,
      audioFileId: state.audioFiles[0]?.id ?? 1,
      shift: state.settings.activeShift,
      isRecurring: true,
      validFrom: new Date().toISOString().slice(0, 10),
      validTo: null,
    });
  };

  const handleSave = (entry: ScheduleEntry) => {
    if (!entry.time?.trim()) {
      alert('Укажите время звонка.');
      return;
    }
    if (entry.id === 0) {
      const newEntry = { ...entry, id: genIds.schedule() };
      dispatch({ type: 'ADD_SCHEDULE', entry: newEntry });
      addLog(`➕ Добавлено событие: ${newEntry.time} (${DAY_NAMES[newEntry.dayOfWeek]})`, { type: 'system', scheduleId: newEntry.id });
    } else {
      dispatch({ type: 'UPDATE_SCHEDULE', entry });
      addLog(`✏️ Изменено событие #${entry.id}`, { type: 'system', scheduleId: entry.id });
    }
    setEditing(null);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Удалить это событие расписания?')) return;
    dispatch({ type: 'DELETE_SCHEDULE', id });
    addLog(`🗑️ Удалено событие #${id}`, { type: 'system' });
  };

  const handleNewHoliday = () => {
    setHolidayEditing({
      id: 0,
      date: new Date().toISOString().slice(0, 10),
      name: '',
      isBellDisabled: true,
      customScheduleJson: null,
    });
  };

  const handleSaveHoliday = (h: Holiday) => {
    if (h.id === 0) {
      dispatch({ type: 'ADD_HOLIDAY', holiday: { ...h, id: genIds.holiday() } });
      addLog(`📅 Добавлен праздник: ${h.name || h.date}`, { type: 'system' });
    } else {
      dispatch({ type: 'UPDATE_HOLIDAY', holiday: h });
    }
    setHolidayEditing(null);
  };

  return (
    <div className="space-y-4 fade-in">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <TabBtn active={tab === 'schedule'} onClick={() => setTab('schedule')}>📅 Расписание звонков</TabBtn>
        <TabBtn active={tab === 'holidays'} onClick={() => setTab('holidays')}>🎉 Праздники и особые дни</TabBtn>
      </div>

      {tab === 'schedule' ? (
        <>
          {/* Day tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1 overflow-x-auto">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  key={d}
                  onClick={() => setActiveDay(d)}
                  className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                  style={{
                    background: activeDay === d ? 'var(--accent-soft)' : 'transparent',
                    color: activeDay === d ? 'var(--accent)' : 'var(--text)',
                    border: '1px solid',
                    borderColor: activeDay === d ? 'transparent' : 'var(--border)',
                  }}
                >
                  {DAY_SHORT[d]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={state.settings.activeShift}
                onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { activeShift: e.target.value } })}
                style={{ width: 'auto' }}
              >
                {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={handleNew} className="btn btn-primary">
                <Icon.Plus /> Добавить звонок
              </button>
            </div>
          </div>

          {/* Поиск + шаблоны + CSV */}
          <div className="card p-3 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[200px] relative">
              <Icon.Search className="absolute left-3 top-1/2 -translate-y-1/2" width={14} height={14} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Поиск по времени, типу, аудио..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 32 }}
              />
            </div>
            <select
              onChange={(e) => { if (e.target.value) { applyTemplate(e.target.value); e.target.value = ''; } }}
              style={{ width: 'auto' }}
              defaultValue=""
            >
              <option value="" disabled>📋 Загрузить шаблон…</option>
              {SCHEDULE_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={handleCsvExport} className="btn btn-secondary" title="Экспорт в CSV (Excel)">
              <Icon.Download width={14} height={14} /> CSV
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleCsvImport(e.target.files)}
              className="hidden"
            />
            <button onClick={() => csvInputRef.current?.click()} className="btn btn-secondary" title="Импорт из CSV">
              <Icon.Upload width={14} height={14} /> CSV
            </button>
          </div>

          {/* Day schedule table */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-semibold">{DAY_NAMES[activeDay]}</h3>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {daySchedule.length} событий
              </span>
            </div>
            {daySchedule.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                <Icon.Clock width={36} height={36} className="mx-auto opacity-40" />
                <div className="mt-2">Нет событий на этот день</div>
                <button onClick={handleNew} className="btn btn-primary mt-3">
                  <Icon.Plus /> Добавить
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--bg-soft)' }}>
                    <tr>
                      <Th>Время</Th>
                      <Th>Смена</Th>
                      <Th>Тип</Th>
                      <Th>Аудио</Th>
                      <Th>Повтор</Th>
                      <Th>Действует</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {daySchedule.map((entry) => {
                      const bt = state.bellTypes.find((b) => b.id === entry.bellTypeId);
                      const audio = state.audioFiles.find((a) => a.id === entry.audioFileId);
                      return (
                        <tr key={entry.id} className="border-t hover:bg-[var(--bg-soft)]" style={{ borderColor: 'var(--border)' }}>
                          <Td>
                            <div className="font-mono font-semibold">
                              {entry.time}
                              {entry.endTime ? <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}> - {entry.endTime}</span> : null}
                            </div>
                          </Td>
                          <Td><span className="chip">{entry.shift}</span></Td>
                          <Td>
                            <span style={{ color: bt?.color }} className="font-medium">
                              <span aria-hidden>{bt?.emoji}</span> {bt?.name}
                            </span>
                          </Td>
                          <Td>
                            <span style={{ color: 'var(--text-muted)' }} className="truncate block max-w-[180px]">
                              {audio?.originalFileName}
                            </span>
                          </Td>
                          <Td>
                            {entry.isRecurring ? (
                              <span className="chip chip-success">ежедневно</span>
                            ) : (
                              <span className="chip">однократно</span>
                            )}
                          </Td>
                          <Td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            с {entry.validFrom}{entry.validTo ? ` по ${entry.validTo}` : ''}
                          </Td>
                          <Td>
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => setEditing(entry)} className="btn btn-ghost p-1.5" title="Изменить">
                                <Icon.Edit width={14} height={14} />
                              </button>
                              <button onClick={() => handleDelete(entry.id)} className="btn btn-ghost p-1.5 hover:!bg-red-100 hover:!text-red-600" title="Удалить">
                                <Icon.Trash width={14} height={14} />
                              </button>
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <HolidaysTab
          onEdit={setHolidayEditing}
          onNew={handleNewHoliday}
        />
      )}

      {editing && (
        <ScheduleEntryModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
      {holidayEditing && (
        <HolidayModal
          holiday={holidayEditing}
          onClose={() => setHolidayEditing(null)}
          onSave={handleSaveHoliday}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
      style={{
        borderColor: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
      }}
    >
      {children}
    </button>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{children}</th>;
}
function Td({ children, className = '', style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <td className={`px-4 py-2.5 ${className}`} style={style}>{children}</td>;
}

function ScheduleEntryModal({ entry, onClose, onSave }: { entry: ScheduleEntry; onClose: () => void; onSave: (e: ScheduleEntry) => void }) {
  const { state } = useApp();
  const [form, setForm] = useState<ScheduleEntry>({
    ...entry,
    endTime: entry.endTime ?? null,
  });

  return (
    <Modal title={entry.id === 0 ? '➕ Новое событие' : '✏️ Изменить событие'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="День недели">
          <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>
            {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </Field>
        <Field label="Время от">
          <input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </Field>
        <Field label="Время до">
          <input
            type="time"
            value={form.endTime ?? ''}
            onChange={(e) => setForm({ ...form, endTime: e.target.value || null })}
          />
        </Field>
        <Field label="Смена">
          <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
            {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Тип звонка">
          <select value={form.bellTypeId} onChange={(e) => setForm({ ...form, bellTypeId: Number(e.target.value) })}>
            {state.bellTypes.map((b) => (
              <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Аудиофайл" className="col-span-2">
          <select value={form.audioFileId} onChange={(e) => setForm({ ...form, audioFileId: Number(e.target.value) })}>
            {state.audioFiles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.originalFileName} ({formatTime(a.durationSeconds)})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Повтор">
          <label className="flex items-center gap-2 px-2 py-1">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
              style={{ width: 'auto' }}
            />
            <span className="text-sm">Повторять ежедневно</span>
          </label>
        </Field>
        <Field label="Действует с">
          <input
            type="date"
            value={form.validFrom}
            onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
          />
        </Field>
        <Field label="Действует по (опц.)" className="col-span-2">
          <input
            type="date"
            value={form.validTo ?? ''}
            onChange={(e) => setForm({ ...form, validTo: e.target.value || null })}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="btn btn-secondary">Отмена</button>
        <button
          onClick={() => {
            if (form.endTime && form.endTime <= form.time) {
              alert('Время окончания должно быть позже времени начала.');
              return;
            }
            onSave(form);
          }}
          className="btn btn-primary"
        >
          <Icon.Save width={14} height={14} /> Сохранить
        </button>
      </div>
    </Modal>
  );
}

function HolidaysTab({ onEdit, onNew }: { onEdit: (h: Holiday) => void; onNew: () => void }) {
  const { state, dispatch, addLog } = useApp();
  const sorted = useMemo(
    () => [...state.holidays].sort((a, b) => a.date.localeCompare(b.date)),
    [state.holidays],
  );
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          В праздничные дни звонки могут быть отключены, либо для них задаётся отдельное расписание.
        </p>
        <button onClick={onNew} className="btn btn-primary">
          <Icon.Plus /> Добавить праздник
        </button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.length === 0 && (
          <div className="card p-8 text-center col-span-full" style={{ color: 'var(--text-muted)' }}>
            <Icon.Star width={36} height={36} className="mx-auto opacity-40" />
            <div className="mt-2">Нет праздников</div>
          </div>
        )}
        {sorted.map((h) => {
          const d = new Date(h.date);
          const dayOfWeek = d.getDay();
          return (
            <div key={h.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    {DAY_NAMES[dayOfWeek]}
                  </div>
                  <div className="text-lg font-semibold mt-0.5">
                    {d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                  </div>
                  {h.name && <div className="text-sm mt-1">{h.name}</div>}
                </div>
                <span className={`chip ${h.isBellDisabled ? 'chip-danger' : 'chip-success'}`}>
                  {h.isBellDisabled ? '🔕 Звонки выкл' : '🔔 Звонки вкл'}
                </span>
              </div>
              <div className="flex gap-1 mt-3 justify-end">
                <button onClick={() => onEdit(h)} className="btn btn-ghost p-1.5"><Icon.Edit width={14} height={14} /></button>
                <button
                  onClick={() => {
                    if (window.confirm(`Удалить праздник "${h.name || h.date}"?`)) {
                      dispatch({ type: 'DELETE_HOLIDAY', id: h.id });
                      addLog(`🗑️ Удалён праздник: ${h.name || h.date}`, { type: 'system' });
                    }
                  }}
                  className="btn btn-ghost p-1.5"
                >
                  <Icon.Trash width={14} height={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HolidayModal({ holiday, onClose, onSave }: { holiday: Holiday; onClose: () => void; onSave: (h: Holiday) => void }) {
  const [form, setForm] = useState<Holiday>(holiday);
  return (
    <Modal title={holiday.id === 0 ? '🎉 Новый праздник' : '✏️ Изменить праздник'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Дата">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Название">
          <input
            type="text"
            placeholder="Например: День знаний"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Поведение">
          <label className="flex items-center gap-2 px-2 py-1">
            <input
              type="checkbox"
              checked={form.isBellDisabled}
              onChange={(e) => setForm({ ...form, isBellDisabled: e.target.checked })}
              style={{ width: 'auto' }}
            />
            <span className="text-sm">Отключить все звонки в этот день</span>
          </label>
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="btn btn-secondary">Отмена</button>
        <button onClick={() => onSave(form)} className="btn btn-primary">
          <Icon.Save width={14} height={14} /> Сохранить
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="card p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="btn btn-ghost p-1"><Icon.X width={16} height={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60) + m + minutes;
  const hh = Math.floor((total % (24 * 60)) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function localTimePlusMinutes(date: Date, minutes: number): string {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
}
