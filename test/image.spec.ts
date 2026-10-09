import { describe, expect, test } from 'vitest';
import { imagePreviewAllowed } from '../src/core/image';

function png(width: number, height: number) {
  const bytes = new Uint8Array(33);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([73, 72, 68, 82], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}
function webp(chunk: string, payload: number[]) {
  const bytes = new Uint8Array(20 + payload.length + (payload.length % 2));
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  view.setUint32(4, bytes.length - 8, true);
  bytes.set(new TextEncoder().encode('WEBP' + chunk), 8);
  view.setUint32(16, payload.length, true);
  bytes.set(payload, 20);
  return bytes;
}
describe('ressources des aperçus image, sans décodage', () => {
  test.each([
    [2000, 2000, true],
    [2001, 2000, false],
    [8192, 1, true],
    [8193, 1, false],
    [1, 8193, false],
    [0, 1, false],
    [1, 0, false],
  ])('borne PNG %i × %i', (width, height, allowed) => {
    expect(imagePreviewAllowed(png(width, height), 'x.png')).toBe(allowed);
  });
  test('refuse les entêtes PNG absents et les formats inconnus', () => {
    expect(imagePreviewAllowed(new Uint8Array(32), 'x.png')).toBe(false);
    expect(imagePreviewAllowed(new Uint8Array(33), 'x.png')).toBe(false);
    const b = png(1, 1);
    b[12] = 0;
    expect(imagePreviewAllowed(b, 'x.png')).toBe(false);
    expect(imagePreviewAllowed(b, 'x.svg')).toBe(false);
    expect(imagePreviewAllowed(new Uint8Array(12), 'x.gif')).toBe(false);
  });
  test('JPEG : saute les métadonnées et vérifie le segment de dimensions', () => {
    const b = new Uint8Array([255, 216, 255, 224, 0, 2, 255, 255, 194, 0, 8, 8, 0, 1, 0, 1, 0]);
    expect(imagePreviewAllowed(b, 'x.jpeg')).toBe(true);
    for (const input of [
      b.subarray(0, 2),
      b.subarray(0, 3),
      b.subarray(0, 8),
      b.subarray(0, 10),
      b.subarray(0, 14),
      new Uint8Array([255, 216, 0]),
      new Uint8Array([255, 216, 255, 218]),
      new Uint8Array([255, 216, 255, 217]),
      new Uint8Array([255, 216, 255, 224, 0, 1]),
      new Uint8Array([255, 216, 255, 192, 0, 2]),
    ]) {
      expect(imagePreviewAllowed(input, 'x.jpg')).toBe(false);
    }
    b[14] = 255;
    b[15] = 255;
    expect(imagePreviewAllowed(b, 'x.jpg')).toBe(false);
  });
  test('WebP : VP8X, VP8L et VP8 bornés', () => {
    expect(imagePreviewAllowed(webp('VP8X', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'x.webp')).toBe(true);
    expect(imagePreviewAllowed(webp('VP8L', [47, 0, 0, 0, 0]), 'x.webp')).toBe(true);
    expect(imagePreviewAllowed(webp('VP8 ', [0, 0, 0, 157, 1, 42, 1, 0, 1, 0]), 'x.webp')).toBe(
      true,
    );
    expect(imagePreviewAllowed(webp('VP8X', [0, 0, 0, 0, 255, 255, 255, 0, 0, 0]), 'x.webp')).toBe(
      false,
    );
    expect(imagePreviewAllowed(webp('VP8L', [47, 255, 255, 255, 15]), 'x.webp')).toBe(false);
  });
  test('WebP : fichiers tronqués, segments inconnus et mauvais entêtes', () => {
    const good = webp('VP8L', [47, 0, 0, 0, 0]);
    expect(imagePreviewAllowed(good.subarray(0, 24), 'x.webp')).toBe(false);
    const oversized = good.slice();
    oversized[16] = 100;
    expect(imagePreviewAllowed(oversized, 'x.webp')).toBe(false);
    const length = good.slice();
    length[4] = 0;
    expect(imagePreviewAllowed(length, 'x.webp')).toBe(false);
    for (const b of [
      webp('XXXX', [0, 0, 0, 0, 0]),
      webp('VP8X', [0, 0, 0, 0, 0, 0]),
      webp('VP8L', [0, 0, 0, 0, 0]),
      webp('VP8L', [47, 0, 0, 0, 224]),
      webp('VP8 ', [0, 0, 0, 0, 1, 42, 1, 0, 1, 0]),
      webp('VP8 ', [1, 0, 0, 157, 1, 42, 1, 0, 1, 0]),
      webp('VP8 ', [0, 0, 0, 0, 0, 0]),
    ]) {
      expect(imagePreviewAllowed(b, 'x.webp')).toBe(false);
    }
  });
});
