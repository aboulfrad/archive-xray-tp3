import { describe, expect, test } from 'vitest';
import { classify, crc32, parseZip, readEntry, unsafePath, visibleName } from '../src/core/zip';
import { LIMITS } from '../src/core/types';
import { central, encode, patch, zip } from './helpers';
describe('lecture ZIP et intégrité', () => {
  test.each([0, 6] as const)(
    'lit STORE/DEFLATE niveau %i, Unicode, vide et octets exacts',
    (level) => {
      const input = zip(
        {
          'projet/café.ts': 'export const x = "été";\n',
          'empty.txt': '',
          'binary.bin': new Uint8Array([0, 255, 17]),
        },
        level,
      );
      const entries = parseZip(input);
      expect(entries).toHaveLength(3);
      expect(new TextDecoder().decode(readEntry(input, entries[0]!))).toBe(
        'export const x = "été";\n',
      );
      expect(readEntry(input, entries[1]!)).toHaveLength(0);
      expect(readEntry(input, entries[2]!)).toEqual(new Uint8Array([0, 255, 17]));
    },
  );
  test('respecte un Uint8Array avec décalage et un ZIP vide', () => {
    const bytes = zip({ 'x.txt': 'hi' });
    const outer = new Uint8Array(bytes.length + 10);
    outer.set(bytes, 5);
    const sub = outer.subarray(5, 5 + bytes.length);
    expect(readEntry(sub, parseZip(sub)[0]!)).toEqual(encode('hi'));
    expect(parseZip(zip({}))).toEqual([]);
  });
  test('CRC32 connu et corruption réelle de données', () => {
    expect(crc32(encode('123456789'))).toBe(0xcbf43926);
    const bytes = zip({ 'a.txt': 'hello' });
    const e = parseZip(bytes)[0]!;
    bytes[35] = bytes[35]! ^ 1;
    expect(() => readEntry(bytes, e)).toThrow(/CRC/);
  });
  test('vérifie la taille réellement produite même si les deux en-têtes mentent', () => {
    const bytes = patch(zip({ 'long.txt': 'x'.repeat(8000) }, 6), { size: 1 });
    expect(() => readEntry(bytes, parseZip(bytes)[0]!)).toThrow(/taille réelle/);
  });
  test('arrête lecture au-delà du budget et taille stockée fausse', () => {
    const stored = patch(zip({ 'a.txt': 'abcdef' }), { size: 1 });
    expect(() => readEntry(stored, parseZip(stored)[0]!, 1)).toThrow(/limite/);
    const bytes = zip({ 'a.txt': 'abcdef' });
    expect(() => readEntry(bytes, parseZip(bytes)[0]!, 3)).toThrow(/limite/);
  });
  test('refuse CRC faux, taille incohérente et deflate invalide', () => {
    const crc = patch(zip({ 'a.txt': 'x' }), { crc: 3 });
    expect(() => readEntry(crc, parseZip(crc)[0]!)).toThrow(/CRC/);
    const size = patch(zip({ 'a.txt': 'x' }), { size: 2 });
    expect(() => readEntry(size, parseZip(size)[0]!)).toThrow(/taille/);
    const deflate = zip({ 'a.txt': 'some text' }, 6);
    deflate[35] = 0xff;
    expect(() => readEntry(deflate, parseZip(deflate)[0]!)).toThrow();
  });
  test('le flag descripteur ne dispense pas du CRC final', () => {
    const bytes = patch(zip({ 'a.txt': 'hello' }), { flags: 8 });
    new DataView(bytes.buffer).setUint32(14, 0, true);
    expect(new TextDecoder().decode(readEntry(bytes, parseZip(bytes)[0]!))).toBe('hello');
  });
  test('refuse chiffrement, lien, traversée et compression inconnue à la lecture', () => {
    const plain = zip({ 'a.txt': 'x' });
    for (const changes of [{ flags: 1 }, { method: 99 }, { attrs: (0xa1ff << 16) >>> 0 }]) {
      const bytes = patch(plain, changes);
      expect(() => readEntry(bytes, parseZip(bytes)[0]!)).toThrow();
    }
    const unsafe = zip({ '../x.txt': 'x' });
    expect(() => readEntry(unsafe, parseZip(unsafe)[0]!)).toThrow(/chemin/);
  });
});
describe('structure hostile ou non prise en charge', () => {
  test('refuse non-ZIP, troncature, octets supplémentaires et répertoire incohérent', () => {
    expect(() => parseZip(encode('not a zip'))).toThrow(/ZIP/);
    const bytes = zip({ 'a.txt': 'hello' });
    expect(() => parseZip(bytes.slice(0, -1))).toThrow(/tronquée/);
    const trailing = new Uint8Array(bytes.length + 1);
    trailing.set(bytes);
    expect(() => parseZip(trailing)).toThrow(/tronquée/);
    const broken = bytes.slice();
    new DataView(broken.buffer).setUint32(broken.length - 6, 1, true);
    expect(() => parseZip(broken)).toThrow(/répertoire/);
  });
  test('accepte commentaire et refuse plusieurs volumes', () => {
    const source = zip({});
    const bytes = new Uint8Array(25);
    bytes.set(source);
    bytes.set(encode('abc'), 22);
    new DataView(bytes.buffer).setUint16(20, 3, true);
    expect(parseZip(bytes)).toEqual([]);
    new DataView(bytes.buffer).setUint16(4, 1, true);
    expect(() => parseZip(bytes)).toThrow(/volumes/);
  });
  test('bloque nombre, volume, ZIP64 et niveaux excessifs avant lecture', () => {
    const count = zip({});
    const v = new DataView(count.buffer);
    v.setUint16(8, 2501, true);
    v.setUint16(10, 2501, true);
    expect(() => parseZip(count)).toThrow(/2 500/);
    v.setUint16(10, 0xffff, true);
    expect(() => parseZip(count)).toThrow(/ZIP64/);
    const total = patch(zip({ 'a.txt': '' }), { size: LIMITS.declaredTotal + 1 });
    expect(() => parseZip(total)).toThrow(/256 Mo/);
    const size64 = patch(zip({ 'a.txt': '' }), { size: 0xffffffff });
    expect(() => parseZip(size64)).toThrow(/ZIP64/);
    expect(() => parseZip(new Uint8Array(LIMITS.archiveBytes + 1))).toThrow(/64 Mo/);
    expect(() => parseZip(zip({ ['dir/'.repeat(65) + 'a.txt']: '' }))).toThrow(/64 niveaux/);
    expect(() => parseZip(zip({ ['a'.repeat(4097)]: '' }))).toThrow(/trop long/);
  });
  test('refuse en-têtes, noms et offsets contradictoires', () => {
    const source = zip({ 'a.txt': 'hello' });
    const c = central(source);
    const mutations = [
      (v: DataView) => v.setUint32(c, 0, true),
      (v: DataView) => v.setUint16(c + 34, 1, true),
      (v: DataView) => v.setUint16(c + 28, 0, true),
      (v: DataView) => v.setUint32(c + 42, c, true),
      (v: DataView) => v.setUint32(0, 0, true),
      (v: DataView) => v.setUint16(26, 4, true),
      (v: DataView) => v.setUint16(6, 1, true),
      (v: DataView) => v.setUint8(30, 98),
      (v: DataView) => v.setUint32(14, 99, true),
      (v: DataView) => v.setUint16(source.length - 12, 0, true),
    ];
    for (const mutate of mutations) {
      const bytes = source.slice();
      mutate(new DataView(bytes.buffer));
      expect(() => parseZip(bytes)).toThrow();
    }
  });
  test('décode CP437 et refuse UTF-8 invalide', () => {
    const source = zip({ 'a.txt': 'x' });
    const c = central(source);
    source[30] = 0x82;
    source[c + 46] = 0x82;
    expect(parseZip(source)[0]!.path).toBe('é.txt');
    const invalid = patch(source, { flags: 0x800 });
    expect(() => parseZip(invalid)).toThrow(/UTF-8/);
  });
  test('refuse des zones de fichiers qui se chevauchent', () => {
    const bytes = zip({ 'a.txt': 'a', 'b.txt': 'b' });
    const c = central(bytes, 1);
    const v = new DataView(bytes.buffer);
    v.setUint32(c + 42, 0, true);
    bytes[c + 46] = 97;
    v.setUint32(c + 16, v.getUint32(central(bytes) + 16, true), true);
    expect(() => parseZip(bytes)).toThrow(/chevauchent/);
  });
});
describe('noms et types', () => {
  test.each([
    '../x',
    'a/../../x',
    '/etc/x',
    'C:\\x',
    'a\\..\\x',
    'x:stream',
    'a/./b',
    'a\u0000b',
    'a//b',
    'a./b',
    'a /b',
  ])('bloque %s', (name) => expect(unsafePath(name)).toBe(true));
  test.each(['src/index.ts', '.env', 'dir/', 'dossier/café.md'])('autorise %s', (name) =>
    expect(unsafePath(name)).toBe(false),
  );
  test.each([
    ['image.png', 'image'],
    ['a.zip', 'archive'],
    ['a.pdf', 'binary'],
    ['package.json', 'config'],
    ['.env', 'config'],
    ['Dockerfile', 'config'],
    ['a.ts', 'code'],
    ['LICENSE', 'document'],
    ['a.md', 'document'],
    ['unknown', 'other'],
  ])('classe %s', (path, kind) => expect(classify(path!)).toBe(kind));
});

describe('champs supplémentaires et noms trompeurs', () => {
  test('accepte un champ inconnu valide mais refuse ZIP64, remplacements de noms et troncature', () => {
    const original = zip({ 'a.txt': 'a' }),
      c = central(original),
      insert = original.length - 22;
    function extra(id: number, declaredSize = 0, byteLength = 4) {
      const bytes = new Uint8Array(original.length + byteLength);
      bytes.set(original.subarray(0, insert));
      bytes.set(original.subarray(insert), insert + byteLength);
      const v = new DataView(bytes.buffer);
      v.setUint16(c + 30, byteLength, true);
      v.setUint32(
        bytes.length - 10,
        new DataView(original.buffer).getUint32(original.length - 10, true) + byteLength,
        true,
      );
      v.setUint16(insert, id, true);
      if (byteLength >= 4) v.setUint16(insert + 2, declaredSize, true);
      return bytes;
    }
    expect(parseZip(extra(0xcafe))).toHaveLength(1);
    expect(() => parseZip(extra(1))).toThrow(/ZIP64/);
    expect(() => parseZip(extra(0x7075))).toThrow(/Unicode/);
    expect(() => parseZip(extra(0xcafe, 5))).toThrow(/invalide/);
    expect(() => parseZip(extra(0xcafe, 0, 3))).toThrow(/tronqué/);
  });
  test.each(['CON', 'NUL.txt', 'dir/COM1.log', 'AUX', 'LPT9.txt'])(
    'refuse le nom de périphérique Windows %s',
    (name) => expect(unsafePath(name)).toBe(true),
  );
});

test('rend les noms bidi/invisibles explicitement lisibles', () => {
  expect(visibleName('doc\u202e.txt')).toBe('doc[U+202E].txt');
  expect(visibleName('README.md')).toBe('README.md');
});
