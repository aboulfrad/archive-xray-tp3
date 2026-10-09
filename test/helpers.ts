import { strToU8, zipSync } from 'fflate';
import { parseZip } from '../src/core/zip';
import type { ArchiveEntry } from '../src/core/types';
export const encode = strToU8;
export function zip(files: Record<string, string | Uint8Array>, level: 0 | 6 = 0): Uint8Array {
  const input: Record<string, Uint8Array> = Object.create(null) as Record<string, Uint8Array>;
  for (const [name, value] of Object.entries(files))
    input[name] = typeof value === 'string' ? encode(value) : value;
  return zipSync(input, { level });
}
export function central(bytes: Uint8Array, index = 0): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = view.getUint32(bytes.length - 6, true);
  for (let i = 0; i < index; i++)
    p +=
      46 +
      view.getUint16(p + 28, true) +
      view.getUint16(p + 30, true) +
      view.getUint16(p + 32, true);
  return p;
}
export function patch(
  bytes: Uint8Array,
  modifications: { flags?: number; method?: number; size?: number; crc?: number; attrs?: number },
  index = 0,
): Uint8Array {
  const result = bytes.slice();
  const view = new DataView(result.buffer);
  const c = central(result, index),
    l = view.getUint32(c + 42, true);
  if (modifications.flags !== undefined) {
    view.setUint16(c + 8, modifications.flags, true);
    view.setUint16(l + 6, modifications.flags, true);
  }
  if (modifications.method !== undefined) {
    view.setUint16(c + 10, modifications.method, true);
    view.setUint16(l + 8, modifications.method, true);
  }
  if (modifications.size !== undefined) {
    view.setUint32(c + 24, modifications.size, true);
    view.setUint32(l + 22, modifications.size, true);
  }
  if (modifications.crc !== undefined) {
    view.setUint32(c + 16, modifications.crc, true);
    view.setUint32(l + 14, modifications.crc, true);
  }
  if (modifications.attrs !== undefined) view.setUint32(c + 38, modifications.attrs, true);
  return result;
}
export function entry(overrides: Partial<ArchiveEntry> = {}): ArchiveEntry {
  return { ...parseZip(zip({ 'file.txt': 'text' }))[0]!, ...overrides };
}
