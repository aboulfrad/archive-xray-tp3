import { expect, test } from 'vitest';
import { LIMITS } from '../src/core/types';
import { inspectArchive, secretFindings } from '../src/core/inspect';
import { compareArchives, createReport, harnessObservations } from '../src/core/project';
import { parseZip, readEntry } from '../src/core/zip';
import { central, entry, zip } from './helpers';

test('limite les secrets répétés sans réintégrer le fichier dans l’export par défaut', () => {
  const file = entry({ text: 'password=ArtificialValue123\n'.repeat(12000) });
  const findings = secretFindings(file);
  expect(findings).toHaveLength(LIMITS.secretsPerFile + 1);
  expect(findings.at(-1)?.rule).toBe('secret-limit');
  expect(file.exportExcluded).toBe(true);
});

test('limite les alertes globales sans perdre les exclusions hors de la liste affichée', async () => {
  const files = Object.fromEntries(
    Array.from({ length: 600 }, (_, i) => [`folder/${i}/.env`, 'x']),
  );
  // All 600 environment files have warnings; a critical path must remain blocked after the cap.
  const a = await inspectArchive(
    zip({ ...files, '../unsafe.txt': 'do not read', '.env': 'x' }),
    'limits.zip',
  );
  expect(a.findings).toHaveLength(LIMITS.findings + 1);
  expect(a.findings.at(-1)?.rule).toBe('finding-limit');
  expect(a.entries.find((e) => e.path === '.env')?.exportExcluded).toBe(true);
  const blocked = a.entries.find((e) => e.path === '../unsafe.txt');
  expect(blocked?.inspected).toBe(false);
  expect(blocked?.text).toBeUndefined();
  expect(blocked?.exportExcluded).toBe(true);
});

test('borne les observations des tests avant la création de milliers de résultats', async () => {
  const a = await inspectArchive(
    zip({ 'many.spec.ts': 'test.skip("later")\n'.repeat(12000) }),
    'many.zip',
  );
  const observations = harnessObservations(a);
  expect(observations).toHaveLength(151);
  expect(observations.at(-1)?.message).toContain('abrégée');
});

test('borne aussi les observations de scripts de manifeste', async () => {
  const scripts = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`s${i}`, 'exit 0']));
  const a = await inspectArchive(
    zip({ 'package.json': JSON.stringify({ scripts }) }),
    'scripts.zip',
  );
  expect(harnessObservations(a)).toHaveLength(151);
});

test('refuse une arborescence dépassant le budget cumulé', () => {
  const files = Object.fromEntries(
    Array.from({ length: 170 }, (_, i) => [`root${i}/${'d/'.repeat(62)}a.txt`, '']),
  );
  expect(() => parseZip(zip(files))).toThrow(/10 000/);
});

test('refuse des noms cumulés supérieurs au budget même si chaque nom est valide', () => {
  const files = Object.fromEntries(
    Array.from({ length: 300 }, (_, i) => [`${i}${'a'.repeat(4000)}.txt`, '']),
  );
  expect(() => parseZip(zip(files))).toThrow(/noms supérieur/);
});

function localExtra(id: number, declared = 0, length = 4): Uint8Array {
  const source = zip({ 'a.txt': 'hello' });
  const old = new DataView(source.buffer);
  const insertion = 30 + old.getUint16(26, true);
  const result = new Uint8Array(source.length + length);
  result.set(source.subarray(0, insertion));
  result.set(source.subarray(insertion), insertion + length);
  const view = new DataView(result.buffer);
  view.setUint16(28, length, true);
  view.setUint16(insertion, id, true);
  if (length >= 4) view.setUint16(insertion + 2, declared, true);
  view.setUint32(result.length - 6, central(source) + length, true);
  return result;
}

test.each([
  [1, /ZIP64/],
  [0x7075, /Unicode/],
])('refuse les extensions locales ambiguës %i', (id, error) => {
  expect(() => parseZip(localExtra(id as number))).toThrow(error as RegExp);
});
test('valide les limites des extensions locales avant leur lecture', () => {
  expect(() => parseZip(localExtra(0xcafe, 5))).toThrow(/invalide/);
  expect(() => parseZip(localExtra(0xcafe, 0, 3))).toThrow(/tronqué/);
  const bytes = localExtra(0xcafe);
  expect(new TextDecoder().decode(readEntry(bytes, parseZip(bytes)[0]!))).toBe('hello');
});

test('rend inertes les liens et HTML dans les annotations du rapport Markdown', async () => {
  const a = await inspectArchive(zip({ 'a.txt': 'text' }), '<img src=x>.zip');
  const annotation =
    '<img src="https://example.com/tracker"> [click](javascript:alert(1)) ` escape';
  const report = createReport(a, 'project', [{ fileId: 0, text: annotation }]);
  expect(report).toContain('Archive : ` <img src=x>.zip `');
  expect(report).toContain(`: \`\` ${annotation} \`\``);
});

test('conserve les chemins extérieurs à la racine lors de la comparaison', async () => {
  const a = await inspectArchive(
    zip({ 'project/README.md': '# readme', '__MACOSX/project/info.txt': 'metadata' }),
    'a.zip',
  );
  expect(compareArchives(a, a).map((e) => e.path)).toEqual([
    'README.md',
    '__MACOSX/project/info.txt',
  ]);
});
