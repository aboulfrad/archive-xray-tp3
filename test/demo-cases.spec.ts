import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { inspectArchive } from '../src/core/inspect';
import { createReport } from '../src/core/project';

test('le ZIP pédagogique réel déclenche les contrôles annoncés sans divulguer les secrets fictifs', async () => {
  const bytes = new Uint8Array(await readFile('public/demos/cas-de-figure.zip'));
  const a = await inspectArchive(bytes, 'cas-de-figure.zip');
  expect(a.entries).toHaveLength(34);
  const rules = new Set(a.findings.map((f) => f.rule));
  for (const expected of [
    'unsafe-path',
    'symlink',
    'encrypted',
    'compression',
    'ratio',
    'unicode',
    'double-extension',
    'executable',
    'env',
    'noise',
    'macos',
    'nested',
    'duplicate',
    'path-conflict',
    'magic',
    'image-bounds',
    'read-error',
    'secret-credential',
    'secret-private-key',
  ])
    expect(rules.has(expected), expected).toBe(true);
  expect(a.findings.find((f) => f.rule === 'image-bounds')?.severity).toBe('info');
  expect(a.entries.find((e) => e.path === 'grande-image.png')?.exportExcluded).not.toBe(true);
  const report = createReport(a, 'project');
  expect(report).not.toContain('FictitiousValue9123');
  expect(JSON.stringify(a.findings)).not.toContain('FictitiousValue9123');
});
