import { LIMITS } from './types';

// Header inspection only: decoding is left to the browser after these resource checks.
export function imagePreviewAllowed(bytes: Uint8Array, path: string): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, length: number) =>
    new TextDecoder().decode(bytes.subarray(offset, offset + length));
  let width = 0;
  let height = 0;
  if (/\.png$/i.test(path)) {
    if (bytes.length < 33 || view.getUint32(8) !== 13 || ascii(12, 4) !== 'IHDR') return false;
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (/\.gif$/i.test(path)) {
    if (bytes.length < 13) return false;
    width = view.getUint16(6, true);
    height = view.getUint16(8, true);
  } else if (/\.jpe?g$/i.test(path)) {
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset++] !== 255) return false;
      while (bytes[offset] === 255) offset++;
      if (offset >= bytes.length) return false;
      const marker = bytes[offset++]!;
      if (marker === 0xda || marker === 0xd9 || offset + 2 > bytes.length) return false;
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) return false;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        if (size < 8) return false;
        height = view.getUint16(offset + 3);
        width = view.getUint16(offset + 5);
        break;
      }
      offset += size;
    }
  } else if (/\.webp$/i.test(path)) {
    if (bytes.length < 25 || view.getUint32(4, true) + 8 !== bytes.length) return false;
    const chunk = ascii(12, 4);
    const size = view.getUint32(16, true);
    if (20 + size + (size % 2) > bytes.length) return false;
    if (chunk === 'VP8X') {
      if (size !== 10 || bytes.length < 30) return false;
      const uint24 = (offset: number) =>
        bytes[offset]! + bytes[offset + 1]! * 256 + bytes[offset + 2]! * 65536;
      width = uint24(24) + 1;
      height = uint24(27) + 1;
    } else if (chunk === 'VP8L') {
      if (size < 5 || bytes[20] !== 0x2f) return false;
      const bits = view.getUint32(21, true);
      if (bits >>> 29) return false;
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    } else if (chunk === 'VP8 ') {
      if (
        size < 10 ||
        bytes[20]! & 1 ||
        bytes[23] !== 0x9d ||
        bytes[24] !== 1 ||
        bytes[25] !== 0x2a
      )
        return false;
      width = view.getUint16(26, true) & 0x3fff;
      height = view.getUint16(28, true) & 0x3fff;
    }
  }
  return (
    width > 0 &&
    height > 0 &&
    width <= LIMITS.imageSide &&
    height <= LIMITS.imageSide &&
    width * height <= LIMITS.imagePixels
  );
}
