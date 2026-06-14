import type { Page } from '@playwright/test';

export async function resetAppState(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('school_bell_db');
  });
}

export function makeWavFile(options: {
  name?: string;
  durationSec?: number;
  sampleRate?: number;
  frequencyHz?: number;
  amplitude?: number;
} = {}) {
  const {
    name = 'test-tone.wav',
    durationSec = 0.25,
    sampleRate = 44_100,
    frequencyHz = 440,
    amplitude = 0.2,
  } = options;

  const sampleCount = Math.max(1, Math.floor(durationSec * sampleRate));
  const data = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * amplitude;
    data[i] = Math.max(-1, Math.min(1, sample)) * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + data.byteLength);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + data.byteLength, true);
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
  view.setUint32(40, data.byteLength, true);

  const out = new Uint8Array(buffer);
  out.set(new Uint8Array(data.buffer), 44);

  return {
    name,
    mimeType: 'audio/wav',
    buffer: Buffer.from(buffer),
  };
}
