// =====================================================
// Страница «Журнал событий»: история всех срабатываний
// =====================================================

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import { Icon } from '../components/Icons';

const PAGE_SIZE = 50;

export function LogsPage() {
  const { state, dispatch, addLog } = useApp();
  const [filter, setFilter] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return state.logs.filter((l) => {
      if (filter !== 'all' && l.type !== filter) return false;
      if (search && !l.message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [state.logs, filter, search]);

  // При смене фильтра — сброс на 1-ю страницу
  useEffect(() => { setPage(0); }, [filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageLogs = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(state.logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `school-bell-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('📥 Журнал экспортирован', { type: 'system' });
  };

  const typeMeta: Record<string, { label: string; cls: string }> = {
    bell: { label: '🔔 Звонок', cls: 'chip-accent' },
    voice: { label: '🎙 Голос', cls: 'chip-warning' },
    live: { label: '📡 Эфир', cls: 'chip-danger' },
    manual: { label: '▶ Вручную', cls: 'chip-success' },
    system: { label: '⚙ Система', cls: '' },
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Icon.Search className="absolute left-3 top-1/2 -translate-y-1/2" width={16} height={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Поиск по сообщению..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">Все типы</option>
          <option value="bell">Звонки</option>
          <option value="voice">Голосовые</option>
          <option value="live">Прямой эфир</option>
          <option value="manual">Ручные</option>
          <option value="system">Системные</option>
        </select>
        <button onClick={exportLogs} className="btn btn-secondary">
          <Icon.Download width={14} height={14} /> Экспорт
        </button>
        <button
          onClick={() => {
            if (window.confirm('Очистить весь журнал?')) {
              dispatch({ type: 'CLEAR_LOGS' });
              addLog('🧹 Журнал очищен', { type: 'system' });
            }
          }}
          className="btn btn-secondary"
        >
          <Icon.Trash width={14} height={14} /> Очистить
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-semibold">Журнал ({filtered.length} записей)</h3>
          {totalPages > 1 && (
            <div className="text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <button className="btn btn-ghost p-1" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>←</button>
              <span>стр. <b style={{ color: 'var(--text)' }}>{currentPage + 1}</b> / {totalPages}</span>
              <button className="btn btn-ghost p-1" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)}>→</button>
            </div>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            <Icon.FileText width={36} height={36} className="mx-auto opacity-40" />
            <div className="mt-2">Журнал пуст</div>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            {pageLogs.map((log) => {
              const meta = typeMeta[log.type] ?? typeMeta.system;
              return (
                <div
                  key={log.id}
                  className="px-4 py-3 border-b flex items-start gap-3 hover:bg-[var(--bg-soft)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span className={`chip ${meta.cls}`}>{meta.label}</span>
                  <span className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                    {new Date(log.timestamp).toLocaleString('ru-RU')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{log.message}</div>
                    {log.audioFileName && (
                      <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                        🎵 {log.audioFileName}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
