// =====================================================
// Страница «Настройки»: тема, громкость, пароль, экспорт/импорт
// =====================================================

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store';
import { Icon } from '../components/Icons';
import { exportSchedule, importSchedule, sha256, exportFullState, importFullState } from '../lib/storage';
import { requestNotificationPermission } from '../lib/store';
import { getMicrophones, requestMicPermission, type AudioDeviceInfo } from '../lib/devices';
import { playTestSound } from '../lib/audio';

/** SHA-256 хеш пароля с префиксом (ТЗ п.6.3). */
async function hashPassword(pw: string): Promise<string> {
  return 'sha256:' + (await sha256(pw));
}

export function SettingsPage() {
  const { state, dispatch, addLog } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pwInput, setPwInput] = useState('');
  const [pwInput2, setPwInput2] = useState('');
  const [unlockInput, setUnlockInput] = useState('');
  const [unlocked, setUnlocked] = useState(!state.settings.passwordHash);

  const isLocked = !!state.settings.passwordHash && !unlocked;

  const handleExport = () => {
    const json = exportSchedule(state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `school-bell-schedule-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('📤 Расписание экспортировано', { type: 'system' });
  };

  const handleImport = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    try {
      const text = await files[0].text();
      const imported = importSchedule(text, state);
      dispatch({ type: 'IMPORT', state: imported });
      addLog(`📥 Расписание импортировано из ${files[0].name}`, { type: 'system' });
      alert('Расписание успешно импортировано.');
    } catch (e: any) {
      alert(`Ошибка импорта: ${e.message ?? e}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const setPassword = async () => {
    if (pwInput.length < 4) {
      alert('Пароль должен быть не короче 4 символов');
      return;
    }
    if (pwInput !== pwInput2) {
      alert('Пароли не совпадают');
      return;
    }
    const h = await hashPassword(pwInput);
    dispatch({ type: 'UPDATE_SETTINGS', settings: { passwordHash: h } });
    setPwInput('');
    setPwInput2('');
    setUnlocked(true);
    addLog('🔒 Установлен пароль на настройки (SHA-256)', { type: 'system' });
  };

  const clearPassword = () => {
    if (!window.confirm('Снять защиту паролем?')) return;
    dispatch({ type: 'UPDATE_SETTINGS', settings: { passwordHash: null } });
    setUnlocked(true);
    addLog('🔓 Защита паролем снята', { type: 'system' });
  };

  const tryUnlock = async () => {
    const h = await hashPassword(unlockInput);
    if (h === state.settings.passwordHash) {
      setUnlocked(true);
      setUnlockInput('');
    } else {
      alert('Неверный пароль');
    }
  };

  // Устройства (микрофон)
  const [mics, setMics] = useState<AudioDeviceInfo[]>([]);
  const refreshMics = async () => {
    await requestMicPermission();
    setMics(await getMicrophones());
  };
  useEffect(() => { if (!isLocked) refreshMics(); }, [isLocked]);

  // Полный бэкап
  const fullBackupInputRef = useRef<HTMLInputElement>(null);
  const handleFullExport = async () => {
    try {
      addLog('💾 Создаю полный бэкап...', { type: 'system' });
      const json = await exportFullState(state);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `school-bell-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addLog('💾 Полный бэкап сохранён (включая аудиофайлы)', { type: 'system' });
    } catch (e: any) {
      addLog(`❌ Ошибка бэкапа: ${e.message ?? e}`, { type: 'system' });
    }
  };
  const handleFullImport = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    try {
      const text = await files[0].text();
      const res = await importFullState(text, state);
      dispatch({ type: 'IMPORT', state: res.state });
      addLog(`💾 Полный бэкап восстановлен: ${res.restoredBlobs} аудио`, { type: 'system' });
      alert(`Восстановлено: ${res.restoredBlobs} аудиофайлов, ${res.state.schedule.length} событий расписания.`);
    } catch (e: any) {
      addLog(`❌ Ошибка восстановления: ${e.message ?? e}`, { type: 'system' });
      alert(`Ошибка: ${e.message ?? e}`);
    }
    if (fullBackupInputRef.current) fullBackupInputRef.current.value = '';
  };

  const wipeAll = () => {
    if (!window.confirm('⚠️ Удалить ВСЕ данные (расписание, аудио, логи) и сбросить настройки? Это действие необратимо.')) return;
    if (!window.confirm('Точно? Все загруженные и записанные аудиофайлы будут удалены.')) return;
    localStorage.clear();
    indexedDB.deleteDatabase('school_bell_db');
    location.reload();
  };

  if (isLocked) {
    return (
      <div className="max-w-md mx-auto card p-8 fade-in">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto rounded-full grid place-items-center" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold">Защита паролем</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Введите пароль для доступа к настройкам
          </p>
        </div>
        <input
          type="password"
          value={unlockInput}
          onChange={(e) => setUnlockInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && tryUnlock()}
          placeholder="Пароль"
          className="mt-6"
          autoFocus
        />
        <button onClick={tryUnlock} className="btn btn-primary w-full mt-3">
          Разблокировать
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in max-w-3xl">
      {/* Service */}
      <div className="card p-5">
        <h2 className="font-semibold text-lg mb-1">⚙️ Служба оповещений</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Аналог Windows Service. Когда служба запущена, звонки воспроизводятся по расписанию автоматически.
        </p>
        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-soft)' }}>
          <div>
            <div className="font-medium">Служба {state.settings.serviceEnabled ? 'запущена' : 'остановлена'}</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {state.settings.serviceEnabled
                ? 'Звонки воспроизводятся по расписанию.'
                : 'Расписание загружено, но воспроизведение отключено.'}
            </div>
          </div>
          <button
            onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { serviceEnabled: !state.settings.serviceEnabled } })}
            className={`btn ${state.settings.serviceEnabled ? 'btn-secondary' : 'btn-success'}`}
          >
            <Icon.Power width={14} height={14} />
            {state.settings.serviceEnabled ? 'Остановить' : 'Запустить'}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-soft)' }}>
          <div>
            <div className="font-medium">Браузерные уведомления</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Показывать системные уведомления при срабатывании звонка.
            </div>
          </div>
          <button
            onClick={() => {
              requestNotificationPermission();
              dispatch({ type: 'UPDATE_SETTINGS', settings: { showNotifications: !state.settings.showNotifications } });
            }}
            className={`btn ${state.settings.showNotifications ? 'btn-secondary' : 'btn-primary'}`}
          >
            {state.settings.showNotifications ? 'Включены' : 'Включить'}
          </button>
        </div>
      </div>

      {/* Audio */}
      <div className="card p-5">
        <h2 className="font-semibold text-lg mb-1">🔊 Аудио</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Громкость по умолчанию для новых аудиофайлов. Индивидуальная громкость задаётся в библиотеке.
        </p>
        <div className="flex items-center gap-3">
          <Icon.Volume />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={state.settings.defaultVolume}
            onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { defaultVolume: Number(e.target.value) } })}
            style={{ padding: 0, height: 6 }}
          />
          <span className="font-mono text-sm w-12 text-right">{Math.round(state.settings.defaultVolume * 100)}%</span>
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span style={{ color: 'var(--text-muted)' }}>Активная смена:</span>
          <select
            value={state.settings.activeShift}
            onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { activeShift: e.target.value } })}
            style={{ width: 'auto' }}
          >
            <option>Первая смена</option>
            <option>Вторая смена</option>
          </select>
        </div>
      </div>

      {/* Theme */}
      <div className="card p-5">
        <h2 className="font-semibold text-lg mb-1">🎨 Оформление</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Переключение между светлой и тёмной темой.</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { theme: 'light' } })}
            className={`p-4 rounded-lg border-2 flex items-center gap-3 ${
              state.settings.theme === 'light' ? 'border-[var(--accent)]' : ''
            }`}
            style={{
              background: state.settings.theme === 'light' ? 'var(--accent-soft)' : 'var(--bg-soft)',
              borderColor: state.settings.theme === 'light' ? 'var(--accent)' : 'var(--border)',
            }}
          >
            <Icon.Sun width={20} height={20} />
            <div className="text-left">
              <div className="font-medium">Светлая</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Днём</div>
            </div>
          </button>
          <button
            onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { theme: 'dark' } })}
            className={`p-4 rounded-lg border-2 flex items-center gap-3`}
            style={{
              background: state.settings.theme === 'dark' ? 'var(--accent-soft)' : 'var(--bg-soft)',
              borderColor: state.settings.theme === 'dark' ? 'var(--accent)' : 'var(--border)',
            }}
          >
            <Icon.Moon width={20} height={20} />
            <div className="text-left">
              <div className="font-medium">Тёмная</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Вечером</div>
            </div>
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="card p-5">
        <h2 className="font-semibold text-lg mb-1">🔒 Безопасность</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Защита настроек и расписания паролем (опционально).
        </p>
        {state.settings.passwordHash ? (
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-soft)' }}>
            <div className="text-sm">
              <div className="font-medium">Пароль установлен ✓</div>
              <div style={{ color: 'var(--text-muted)' }}>Доступ к настройкам защищён</div>
            </div>
            <button onClick={clearPassword} className="btn btn-secondary">
              <Icon.X width={14} height={14} /> Снять защиту
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              type="password"
              value={pwInput}
              onChange={(e) => setPwInput(e.target.value)}
              placeholder="Новый пароль (мин. 4 символа)"
            />
            <input
              type="password"
              value={pwInput2}
              onChange={(e) => setPwInput2(e.target.value)}
              placeholder="Подтверждение"
            />
            <button onClick={setPassword} className="btn btn-primary sm:col-span-2">
              <Icon.Check width={14} height={14} /> Установить пароль
            </button>
          </div>
        )}
      </div>

      {/* Устройства (микрофон) */}
      <div className="card p-5">
        <h2 className="font-semibold text-lg mb-1">🎤 Устройства</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Выберите микрофон, который будет использоваться для записи и прямого эфира.
          Браузер требует разрешения на доступ к микрофону для отображения названий устройств.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={state.settings.audioDeviceId}
            onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { audioDeviceId: e.target.value } })}
            style={{ width: 'auto', minWidth: 280 }}
          >
            <option value="default">🎤 Системный микрофон по умолчанию</option>
            {mics.map((m) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label}
              </option>
            ))}
          </select>
          <button onClick={refreshMics} className="btn btn-secondary">
            Обновить список
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm">
          <button
            onClick={() => { playTestSound().then(() => addLog('🔊 Тест звука проигран', { type: 'system' })); }}
            className="btn btn-secondary"
          >
            <Icon.Volume width={14} height={14} /> Тест звука
          </button>
          <span style={{ color: 'var(--text-muted)' }}>
            Проиграет короткий сигнал для проверки динамиков.
          </span>
        </div>
      </div>

      {/* Резервная копия (расписание) */}
      <div className="card p-5">
        <h2 className="font-semibold text-lg mb-1">💾 Резервная копия (расписание)</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Экспорт и импорт расписания, типов звонков и праздников в формате JSON.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} className="btn btn-primary">
            <Icon.Download width={14} height={14} /> Экспорт расписания
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={(e) => handleImport(e.target.files)}
            className="hidden"
          />
          <button onClick={() => fileInputRef.current?.click()} className="btn btn-secondary">
            <Icon.Upload width={14} height={14} /> Импорт
          </button>
        </div>
      </div>

      {/* Полный бэкап */}
      <div className="card p-5">
        <h2 className="font-semibold text-lg mb-1">💼 Полный бэкап</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Сохраняет всё: расписание, аудиотеку (включая загруженные/записанные файлы), настройки и логи.
          Файл может быть большим — в нём base64-кодированные аудио.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleFullExport} className="btn btn-primary">
            <Icon.Download width={14} height={14} /> Экспорт всего
          </button>
          <input
            ref={fullBackupInputRef}
            type="file"
            accept="application/json"
            onChange={(e) => handleFullImport(e.target.files)}
            className="hidden"
          />
          <button onClick={() => fullBackupInputRef.current?.click()} className="btn btn-secondary">
            <Icon.Upload width={14} height={14} /> Восстановить из бэкапа
          </button>
        </div>
      </div>

      {/* About */}
      <div className="card p-5">
        <h2 className="font-semibold text-lg mb-1">ℹ️ О программе</h2>
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          Веб-версия приложения «Школьный звонок» — аналог C#/WPF/.NET 8 решения с NAudio.
          В этом демо данные хранятся в браузере (IndexedDB + localStorage).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Info label="Аудиофайлов" value={state.audioFiles.length} />
          <Info label="Событий" value={state.schedule.length} />
          <Info label="Праздников" value={state.holidays.length} />
          <Info label="Логов" value={state.logs.length} />
        </div>
        <button onClick={wipeAll} className="btn btn-secondary mt-4 hover:!bg-red-100 hover:!text-red-600 hover:!border-red-200">
          <Icon.Trash width={14} height={14} /> Сбросить все данные
        </button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-soft)' }}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
