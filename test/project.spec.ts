import { describe, expect, test } from 'vitest';
import { inspectArchive } from '../src/core/inspect';
import {
  checklist,
  compareArchives,
  createReport,
  harnessObservations,
  projectRoot,
  relativePath,
} from '../src/core/project';
import { exportFiltered } from '../src/core/export';
import { LIMITS } from '../src/core/types';
import { parseZip, readEntry } from '../src/core/zip';
import { entry, patch, zip } from './helpers';

describe('préparer une lecture et un rapport', () => {
  test('repère les éléments de TP3 sans attribuer une note ou prouver leur exécution', async () => {
    const names = [
      'README.md',
      'package.json',
      'test/a.spec.ts',
      '.github/workflows/check.yml',
      'package-lock.json',
      'AGENTS.md',
      'opencode.json',
      '.agents/skills/validation/SKILL.md',
      'captures/a.png',
      '.opencode/agent/review.md',
      '.opencode/plugin/check.js',
      '.opencode/command/check.md',
    ];
    const a = await inspectArchive(
      zip(Object.fromEntries(names.map((n) => ['root/' + n, '']))),
      'complete.zip',
    );
    expect(checklist(a, 'tp3')).toHaveLength(12);
    expect(checklist(a, 'tp3').every((i) => i.status === 'found')).toBe(true);
    expect(checklist(a, 'project')).toHaveLength(5);
    expect(checklist(a, 'tp1').at(-1)!.id).toBe('report');
  });
  test('les tests des dépendances ne valident pas les tests du projet', async () => {
    const a = await inspectArchive(
      zip({ 'root/node_modules/other/x.spec.ts': '', 'root/README.md': 'Read' }),
      'deps.zip',
    );
    expect(checklist(a, 'tp3').find((i) => i.id === 'tests')!.status).toBe('missing');
  });
  test('normalise le dossier racine unique, y compris des chemins Windows', () => {
    const entries = [entry({ path: 'root\\src\\a.ts' }), entry({ path: 'root\\README.md' })];
    expect(projectRoot(entries)).toBe('root/');
    expect(relativePath(entries[0]!, entries)).toBe('src/a.ts');
    expect(projectRoot([entry({ path: 'README.md' })])).toBe('');
    expect(projectRoot([])).toBe('');
  });
  test('signale le faux vert et les tests désactivés sans prétendre connaître leur intention', async () => {
    const a = await inspectArchive(
      zip({
        'package.json': '{"scripts":{"test":"vitest || true","other":1,"ok":"vitest run"}}',
        'x.spec.ts': 'test.skip("x",()=>{});\nexpect(true).toBe(true);',
        'x.ts': '// @ts-nocheck',
      }),
      'badchecks.zip',
    );
    expect(harnessObservations(a)).toHaveLength(4);
    a.entries[0]!.text = '{oops';
    expect(harnessObservations(a)[0]!.message).toContain('JSON');
    a.entries[0]!.text = '{}';
    expect(harnessObservations(a)).toHaveLength(3);
  });
  test('un rapport masque les secrets et cite les contenus non analysés', async () => {
    const a = await inspectArchive(
      zip({
        '.env': 'password=SuperPrivateValue123',
        'README.md': '# Intro',
        'inside.zip': 'nested',
      }),
      'test.zip',
    );
    const report = createReport(a, 'tp3', [
      { fileId: 1, text: 'password=SuperPrivateValue123 | opinion\n', line: 2 },
      { fileId: 999, text: 'À vérifier' },
    ]);
    expect(report).not.toContain('SuperPrivateValue123');
    expect(report).toContain('inside.zip');
    expect(report).toContain('Aucun code ni test');
    expect(report).toContain('\\|');
    expect(report).toContain('` archive ` : ` À vérifier `');
  });
  test('le rapport sans signal explicite la portée limitée', async () => {
    const a = await inspectArchive(zip({ 'README.md': '# Hi' }), 'clear.zip');
    expect(createReport(a, 'project')).toContain('Aucun signal détecté');
  });
});

describe('comparaison de rendus', () => {
  test('distingue ajouts, suppressions, modifications et fichiers identiques malgré la racine', async () => {
    const before = await inspectArchive(
      zip({ 'v1/a.txt': 'old', 'v1/gone.txt': 'gone', 'v1/same.txt': 'same' }),
      'v1.zip',
    );
    const after = await inspectArchive(
      zip({ 'v2/a.txt': 'new', 'v2/added.txt': 'add', 'v2/same.txt': 'same' }),
      'v2.zip',
    );
    expect(compareArchives(before, after).map((c) => [c.path, c.state])).toEqual([
      ['a.txt', 'changed'],
      ['added.txt', 'added'],
      ['gone.txt', 'removed'],
      ['same.txt', 'same'],
    ]);
  });
  test('compare les métadonnées de fichiers non lus et ne cache pas des chemins dupliqués', async () => {
    const a = await inspectArchive(
      zip({ 'a.bin': new Uint8Array([0, 1]), 'dir/': '', 'same.txt': 'hi' }),
      'a.zip',
    );
    expect(compareArchives(a, a).every((c) => c.state === 'same')).toBe(true);
    a.entries.push({ ...a.entries[0]!, id: 50 });
    expect(compareArchives(a, a).filter((c) => c.path.includes('[entrée'))).toHaveLength(2);
  });
});

describe('export contrôlé et origine inchangée', () => {
  test.each([
    ['folder', 'folder/readme.txt'],
    ['folder/readme.txt', 'folder'],
    ['Folder', 'folder/readme.txt'],
    ['folder', 'FOLDER\\readme.txt'],
    ['café', 'cafe\u0301/readme.txt'],
    ['a/b', 'a/b/c/d.txt'],
  ])('refuse un conflit fichier/dossier : %s et %s', (a, b) => {
    const bytes = zip({ [a]: 'a', [b]: 'b' });
    expect(() => exportFiltered(bytes, parseZip(bytes), new Set([0, 1]))).toThrow(/Collision/);
    const single = exportFiltered(bytes, parseZip(bytes), new Set([1]));
    expect(parseZip(single)).toHaveLength(1);
  });
  test('ré-exporte uniquement la sélection, préserve les octets et revérifie le CRC', () => {
    const original = zip({
      'README.md': 'Read',
      'src/x.ts': 'export const x=1;',
      'extra.txt': 'exclude',
    });
    const snapshot = original.slice();
    const entries = parseZip(original);
    const out = exportFiltered(original, entries, new Set([0, 1]));
    const exported = parseZip(out);
    expect(exported.map((e) => e.path)).toEqual(['README.md', 'src/x.ts']);
    expect(readEntry(out, exported[1]!)).toEqual(readEntry(original, entries[1]!));
    expect(original).toEqual(snapshot);
  });
  test('refuse une sélection vide, un secret reste inchangé si explicitement conservé', () => {
    const original = zip({ '.env': 'password=RealValue123' });
    const entries = parseZip(original);
    expect(() => exportFiltered(original, entries, new Set())).toThrow(/au moins/);
    const out = exportFiltered(original, entries, new Set([0]));
    expect(new TextDecoder().decode(readEntry(out, parseZip(out)[0]!))).toContain('RealValue123');
  });
  test('refuse traversée, lien, chiffrement, compression et expansion suspecte', () => {
    for (const [bytes, id] of [
      [zip({ '../x.txt': 'x' }), 0],
      [patch(zip({ 'x.txt': 'x' }), { flags: 1 }), 0],
      [patch(zip({ 'x.txt': 'x' }), { method: 99 }), 0],
      [patch(zip({ 'x.txt': 'x' }), { attrs: (0xa1ff << 16) >>> 0 }), 0],
      [zip({ 'bomb.txt': 'x'.repeat(100000) }, 6), 0],
    ] as const) {
      expect(() => exportFiltered(bytes, parseZip(bytes), new Set([id]))).toThrow(/refusé/);
    }
  });
  test('refuse chemins en collision et budget dépassé', () => {
    const bytes = zip({ 'a.txt': 'a', 'A.TXT': 'a' });
    expect(() => exportFiltered(bytes, parseZip(bytes), new Set([0, 1]))).toThrow(/collision/);
    const huge = zip({ 'huge.bin': new Uint8Array(LIMITS.exportBytes + 1) });
    expect(() => exportFiltered(huge, parseZip(huge), new Set([0]))).toThrow(/32 Mo|refusé/);
  });
  test('les dossiers ne constituent pas une sélection exportable', () => {
    const bytes = zip({ 'dir/': '' });
    expect(() => exportFiltered(bytes, parseZip(bytes), new Set([0]))).toThrow(/au moins/);
  });
});

test('les chemins Windows gardent une checklist fiable, hors dépendances', async () => {
  const a = await inspectArchive(
    zip({
      'root\\README.md': '# Read',
      'root\\package.json': '{}',
      'root\\node_modules\\other\\a.spec.ts': 'test("x",()=>{});',
    }),
    'windows.zip',
  );
  expect(checklist(a, 'project').find((i) => i.id === 'readme')!.status).toBe('found');
  expect(checklist(a, 'project').find((i) => i.id === 'tests')!.status).toBe('missing');
  expect(a.entries[2]!.inspected).toBe(false);
  expect(a.findings.some((f) => f.rule === 'noise')).toBe(true);
  expect(harnessObservations(a)).toEqual([]);
});
