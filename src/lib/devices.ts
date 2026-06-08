// =====================================================
// Работа с аудио-устройствами через MediaDevices API
// =====================================================

export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

/** Запросить список микрофонов. Может требовать разрешения на доступ к микрофону. */
export async function getMicrophones(): Promise<AudioDeviceInfo[]> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Микрофон', kind: 'audioinput' as const }));
  } catch (e) {
    console.error('Не удалось получить список устройств', e);
    return [];
  }
}

/** Запросить список динамиков (при наличии поддержки) */
export async function getSpeakers(): Promise<AudioDeviceInfo[]> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audiooutput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Динамик', kind: 'audiooutput' as const }));
  } catch (e) {
    return [];
  }
}

/** Запросить разрешение на использование микрофона (чтобы появились лейблы устройств) */
export async function requestMicPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

/** Подписаться на изменения устройств */
export function watchDevices(cb: () => void): () => void {
  if (!navigator.mediaDevices || !('addEventListener' in navigator.mediaDevices)) {
    return () => {};
  }
  navigator.mediaDevices.addEventListener('devicechange', cb);
  return () => navigator.mediaDevices.removeEventListener('devicechange', cb);
}
