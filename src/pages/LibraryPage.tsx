// =====================================================
// Страница «Библиотека аудио»: загрузка, прослушивание, удаление
// =====================================================

import { useRef, useState } from 'react';
import { useApp } from '../lib/store';
import { Icon } from '../components/Icons';
import { formatDuration, playAudioFile, stopAudio } from '../lib/audio';
import { loadAudioBlob } from '../lib/storage';
import type { AudioFile } from '../lib/types';

export function LibraryPage() {
  const { state, uploadAudio, deleteAudio, addLog } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'Uploaded' | 'RecordedFromMic' | 'BuiltIn'>('all');
  const [playing, setPlaying] = useState<number | null>(null);
  const [editingTranscript, setEditingTranscript] = useState<number | null>(null);

  const filtered = state.audioFiles.filter((a) => {
    if (filter !== 'all' && a.sourceType !== filter) return false;
    if (search && !a.originalFileName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await uploadAudio(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePlay = async (file: AudioFile) => {
    if (playing === file.id) {
      stopAudio();
      setPlaying(null);
      addLog('⏹ Остановлено воспроизведение', { type: 'manual' });
    } else {
      if (playing !== null) stopAudio();
      setPlaying(file.id);
      addLog(`▶️ Прослушивание: ${file.originalFileName}`, { type: 'manual', audioFileName: file.fileName });
      await playAudioFile(file);
      setPlaying((p) => (p === file.id ? null : p));
    }
  };

  const handleDelete = async (file: AudioFile) => {
    if (file.isInUse) {
      alert(`Невозможно удалить «${file.originalFileName}» — он используется в расписании.`);
      return;
    }
    if (!window.confirm(`Удалить аудиофайл «${file.originalFileName}»?`)) return;
    await deleteAudio(file.id);
  };

  const handleUpdate = (file: AudioFile, patch: Partial<AudioFile>) => {
    // вызываем напрямую через dispatch
    useApp().dispatch({ type: 'UPDATE_AUDIO', file: { ...file, ...patch } });
  };

  const handleDownload = async (file: AudioFile) => {
    if (!file.blobKey) return;
    const blob = await loadAudioBlob(file.blobKey);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 fade-in">
      {/* Toolbar */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Icon.Search className="absolute left-3 top-1/2 -translate-y-1/2" width={16} height={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Поиск по названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} style={{ width: 'auto' }}>
          <option value="all">Все</option>
          <option value="BuiltIn">Встроенные</option>
          <option value="Uploaded">Загруженные</option>
          <option value="RecordedFromMic">С микрофона</option>
        </select>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />
        <button onClick={() => fileInputRef.current?.click()} className="btn btn-primary">
          <Icon.Upload /> Загрузить аудио
        </button>
      </div>

      {/* List */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 && (
          <div className="card p-10 text-center col-span-full" style={{ color: 'var(--text-muted)' }}>
            <Icon.Music width={42} height={42} className="mx-auto opacity-40" />
            <div className="mt-2">Нет аудиофайлов</div>
            <button onClick={() => fileInputRef.current?.click()} className="btn btn-primary mt-3">
              <Icon.Upload /> Загрузить
            </button>
          </div>
        )}
        {filtered.map((file) => (
          <div key={file.id} className="card p-4 flex flex-col">
            <div className="flex items-start gap-3">
              <div
                className="h-12 w-12 rounded-lg grid place-items-center text-2xl flex-shrink-0"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                {file.sourceType === 'BuiltIn' ? '🔔' : file.sourceType === 'RecordedFromMic' ? '🎙' : '🎵'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate" title={file.originalFileName}>{file.originalFileName}</div>
                <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                  <span>{file.fileName}</span>
                  <span>·</span>
                  <span>{formatDuration(file.durationSeconds)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className={`chip ${file.sourceType === 'BuiltIn' ? 'chip-accent' : file.sourceType === 'RecordedFromMic' ? 'chip-warning' : 'chip-success'}`}>
                    {file.sourceType === 'BuiltIn' ? 'Встроенный' : file.sourceType === 'RecordedFromMic' ? 'С микрофона' : 'Загружен'}
                  </span>
                  {file.isInUse && <span className="chip chip-success">в расписании</span>}
                </div>
              </div>
            </div>

            {/* Transcript */}
            {editingTranscript === file.id ? (
              <div className="mt-3 space-y-1">
                <textarea
                  value={file.transcriptText}
                  onChange={(e) => handleUpdate(file, { transcriptText: e.target.value })}
                  placeholder="Что было записано..."
                  rows={2}
                />
                <button
                  onClick={() => setEditingTranscript(null)}
                  className="btn btn-secondary text-xs w-full"
                >
                  Готово
                </button>
              </div>
            ) : file.transcriptText ? (
              <div
                onClick={() => setEditingTranscript(file.id)}
                className="mt-3 p-2 rounded-md text-xs cursor-pointer"
                style={{ background: 'var(--bg-soft)', color: 'var(--text-muted)' }}
                title="Кликните для изменения"
              >
                📝 {file.transcriptText}
              </div>
            ) : file.sourceType === 'RecordedFromMic' ? (
              <button
                onClick={() => setEditingTranscript(file.id)}
                className="mt-3 text-xs text-left"
                style={{ color: 'var(--text-muted)' }}
              >
                + Добавить текстовую заметку
              </button>
            ) : null}

            {/* Volume */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Icon.Volume width={12} height={12} /> Громкость
                </span>
                <span className="text-xs font-mono">{Math.round(file.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={file.volume}
                onChange={(e) => handleUpdate(file, { volume: Number(e.target.value) })}
                style={{ padding: 0, height: 6 }}
              />
            </div>

            {/* Actions */}
            <div className="mt-3 flex gap-1.5 flex-wrap">
              <button
                onClick={() => handlePlay(file)}
                className={`btn ${playing === file.id ? 'btn-primary' : 'btn-secondary'} flex-1`}
              >
                {playing === file.id ? <><Icon.Stop width={14} height={14} /> Стоп</> : <><Icon.Play width={14} height={14} /> Слушать</>}
              </button>
              <button onClick={() => handleDownload(file)} className="btn btn-secondary" title="Скачать">
                <Icon.Download width={14} height={14} />
              </button>
              <button
                onClick={() => handleDelete(file)}
                className="btn btn-secondary hover:!bg-red-100 hover:!text-red-600 hover:!border-red-200"
                disabled={file.isInUse}
                title={file.isInUse ? 'Используется в расписании' : 'Удалить'}
              >
                <Icon.Trash width={14} height={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
