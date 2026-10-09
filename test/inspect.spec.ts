import { expect, test, describe, vi } from 'vitest';
import { inspectArchive, metadataFindings, redactText, secretFindings } from '../src/core/inspect';
import { LIMITS } from '../src/core/types';
import { encode, entry, patch, zip } from './helpers';

describe('constats expliqués', () => {
  test('repère les chemins, liens, ratio, Unicode, exécutables, doublons et dépendances', () => {
    const entries = [
      entry({ id: 0, path: '../exit.txt' }),
      entry({ id: 1, path: 'link', symlink: true }),
      entry({ id: 2, path: 'bomb.txt', size: 100000, compressedSize: 10 }),
      entry({ id: 3, path: 'rapport.pdf.exe', executable: true }),
      entry({ id: 4, path: 'doc\u202e.txt' }),
      entry({ id: 5, path: '.env' }),
      entry({ id: 6, path: 'node_modules/x' }),
      entry({ id: 7, path: '__MACOSX/file' }),
      entry({ id: 8, path: 'bundle.zip', kind: 'archive' }),
      entry({ id: 9, path: 'README.md' }),
      entry({ id: 10, path: 'readme.MD' }),
      entry({ id: 11, path: 'secret.txt', flags: 1 }),
      entry({ id: 12, path: 'other.txt', method: 99 }),
    ];
    expect(new Set(metadataFindings(entries).map((f) => f.rule))).toEqual(
      new Set([
        'unsafe-path',
        'symlink',
        'ratio',
        'executable',
        'double-extension',
        'unicode',
        'env',
        'noise',
        'macos',
        'nested',
        'duplicate',
        'encrypted',
        'compression',
      ]),
    );
  });
  test('n’accuse pas les petits fichiers compressés ni les exemples .env', () => {
    expect(
      metadataFindings([
        entry({ path: '.env.example' }),
        entry({ path: 'small.txt', size: 500, compressedSize: 1 }),
      ]),
    ).toEqual([]);
  });
  test.each([
    ['const t = "ghp_' + 'A'.repeat(30) + '";', 'token'],
    ['-----BEGIN PRIVATE KEY-----', 'private-key'],
    ['PASSWORD=ReallySecret123', 'credential'],
    ['const uri="postgres://user:secretpass@localhost/db"', 'connection'],
  ])('trouve un secret potentiel : %s', (text, kind) => {
    const findings = secretFindings(entry({ text }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.rule).toBe(`secret-${kind}`);
    expect(findings[0]!.line).toBe(1);
    expect(JSON.stringify(findings)).not.toContain('ReallySecret123');
  });
  test('ignore les exemples évidents, contenus absents et garde les numéros de ligne', () => {
    expect(secretFindings(entry())).toEqual([]);
    expect(
      secretFindings(
        entry({
          text: 'API_KEY=your_key_here\npassword=changeme_now\nsecret=process.env.KEY\npassword=example_value',
        }),
      ),
    ).toEqual([]);
    expect(secretFindings(entry({ text: '\n\npassword=ActualValue123' }))[0]!.line).toBe(3);
  });
  test('masque tokens, clés multilignes, affectations et mots de passe de connexion', () => {
    const source =
      'ghp_' +
      'A'.repeat(30) +
      '\n-----BEGIN RSA PRIVATE KEY-----\nabcdef\n-----END RSA PRIVATE KEY-----\npassword="VeryPrivate999"\npostgres://joe:DBPassword999@host/db';
    const masked = redactText(source);
    expect(masked).not.toContain('VeryPrivate999');
    expect(masked).not.toContain('DBPassword999');
    expect(masked).not.toContain('abcdef');
    expect(masked).toContain('[TOKEN MASQUÉ]');
    expect(redactText('hello')).toBe('hello');
  });
});

describe('inspection bornée', () => {
  test('lit les textes et marque précisément le contenu non lu', async () => {
    const progress = vi.fn();
    const a = await inspectArchive(
      zip({
        'README.md': '# Hi',
        'src/x.ts': 'export const x=1;',
        '.env': 'API_KEY=PotentialSecret123',
        'node_modules/x.ts': 'secret=VerySecret999',
        'inside.zip': 'not opened',
        'big.txt': 'a'.repeat(LIMITS.previewBytes + 1),
        'folder/': '',
      }),
      'test.zip',
      progress,
    );
    expect(a.name).toBe('test.zip');
    expect(a.inspectedCount).toBe(3);
    expect(a.entries.find((e) => e.path === 'node_modules/x.ts')!.text).toBeUndefined();
    expect(a.entries.find((e) => e.path === 'big.txt')!.reason).toMatch(/1 Mo/);
    expect(a.entries.find((e) => e.path === 'inside.zip')!.reason).toMatch(/imbriquée/);
    expect(a.entries.find((e) => e.directory)!.reason).toBe('Dossier');
    expect(progress).toHaveBeenCalled();
    expect(a.findings.some((f) => f.rule.startsWith('secret-'))).toBe(true);
  });
  test('ne décompresse jamais une expansion suspecte ni un chemin traversant', async () => {
    const a = await inspectArchive(
      zip({ 'bomb.txt': 'a'.repeat(100000), '../out.txt': 'outside' }, 6),
      'bomb.zip',
    );
    expect(a.inspectedCount).toBe(0);
    expect(a.findings.map((f) => f.rule)).toEqual(expect.arrayContaining(['ratio', 'unsafe-path']));
  });
  test('isole une corruption et continue les autres fichiers', async () => {
    const a = await inspectArchive(
      patch(zip({ 'bad.txt': 'bad', 'good.txt': 'good' }), { crc: 1 }),
      'bad.zip',
    );
    expect(a.entries[0]!.inspected).toBe(false);
    expect(a.entries[1]!.text).toBe('good');
    expect(a.findings[0]!.rule).toBe('read-error');
  });
  test.each([{ flags: 1 }, { method: 99 }, { attrs: (0xa1ff << 16) >>> 0 }])(
    'déclare un contenu non contrôlé : %j',
    async (changes) => {
      const a = await inspectArchive(patch(zip({ 'x.txt': 'x' }), changes), 'x.zip');
      expect(a.inspectedCount).toBe(0);
      expect(a.entries[0]!.reason).toBeTruthy();
    },
  );
  test('respecte le budget total sans annoncer une lecture complète', async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 14; i++) files[`f${i}.txt`] = 'x'.repeat(LIMITS.previewBytes);
    const a = await inspectArchive(zip(files), 'large.zip');
    expect(a.contentBytes).toBe(LIMITS.contentBudget);
    expect(a.inspectedCount).toBe(12);
    expect(a.entries.filter((e) => e.reason?.includes('12 Mo'))).toHaveLength(2);
  });
  test('différencie binaire, UTF-8 invalide, fichier vide et SVG inerte', async () => {
    const a = await inspectArchive(
      zip({
        'zero.txt': '',
        'invalid.txt': new Uint8Array([255, 254]),
        'binary.txt': new Uint8Array([0, 17]),
        'logo.svg': '<svg onload="alert(1)"/>',
        'binary.bin': new Uint8Array([0, 1]),
      }),
      'encodings.zip',
    );
    expect(a.entries[0]!.text).toBe('');
    expect(a.entries[1]!.reason).toContain('UTF-8');
    expect(a.entries[2]!.text).toBeUndefined();
    expect(a.entries[3]!.text).toContain('<svg');
    expect(a.entries[3]!.bytes).toBeUndefined();
    expect(a.inspectedCount).toBe(5);
  });
  test.each(['fake.png', 'fake.jpg', 'fake.gif', 'fake.webp', 'fake.txt', 'elf.bin'])(
    'repère une signature incohérente : %s',
    async (name) => {
      const contents =
        name === 'fake.txt'
          ? encode('MZ fake')
          : name === 'elf.bin'
            ? new Uint8Array([127, 69, 76, 70])
            : encode('not an image');
      const a = await inspectArchive(zip({ [name]: contents }), 'magic.zip');
      expect(a.findings.some((f) => f.rule === 'magic')).toBe(true);
      expect(a.entries[0]!.bytes).toBeUndefined();
    },
  );
  test.each([
    ['real.png', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
    ['real.jpg', new Uint8Array([255, 216, 255])],
    ['real.gif', encode('GIF89a')],
    ['real.webp', encode('RIFFxxxxWEBP')],
  ])('autorise l’aperçu uniquement après signature %s', async (name, bytes) => {
    const a = await inspectArchive(zip({ [name]: bytes }), 'images.zip');
    expect(a.entries[0]!.bytes).toEqual(bytes);
    expect(a.findings).toEqual([]);
  });
});
