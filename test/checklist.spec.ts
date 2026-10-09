import { describe, expect, test } from 'vitest';
import { checklistRules, customChecklist, MAX_CHECKLIST_RULES } from '../src/core/checklist';
import { inspectArchive } from '../src/core/inspect';
import { checklist, createReport } from '../src/core/project';
import { entry, zip } from './helpers';

describe('règles de checklist personnalisée', () => {
  test('valide et borne les règles enregistrées sans convertir les objets', () => {
    let coerced = false;
    const hostileKind = {
      toString() {
        coerced = true;
        throw new Error('conversion interdite');
      },
    };
    expect(
      checklistRules([
        null,
        [],
        5,
        { label: 'a', kind: hostileKind, target: 'README.md' },
        { label: 'a', kind: 0, target: 'README.md' },
        { label: 'a', kind: 'script', target: 'README.md' },
        { label: {}, kind: 'name', target: 'README.md' },
        { label: 'a', kind: 'name', target: {} },
        { label: '  Instructions  ', kind: 'name', target: ' README.md ' },
      ]),
    ).toEqual([{ label: 'Instructions', kind: 'name', target: 'README.md' }]);
    expect(coerced).toBe(false);
    expect(checklistRules({})).toEqual([]);
    expect(checklistRules('[]')).toEqual([]);
    expect(checklistRules(undefined)).toEqual([]);
    const many = Array.from({ length: MAX_CHECKLIST_RULES + 10 }, (_, i) => ({
      label: `Règle ${i}`,
      kind: 'name',
      target: `${i}.txt`,
    }));
    expect(checklistRules(many)).toHaveLength(MAX_CHECKLIST_RULES);
    expect(checklistRules(many).at(-1)?.target).toBe('19.txt');
  });

  test('refuse libellés/cibles vides, surdimensionnés et caractères de contrôle', () => {
    const rule = { label: 'Fichier', kind: 'name', target: 'README.md' };
    const invalid = [
      { ...rule, label: '   ' },
      { ...rule, target: '\t' },
      { ...rule, label: 'a'.repeat(81) },
      { ...rule, target: 'a'.repeat(161) },
      { ...rule, label: 'Avant\u0000Après' },
      { ...rule, target: 'a\nREADME.md' },
      { ...rule, target: 'a\u007f.txt' },
    ];
    expect(checklistRules(invalid)).toEqual([]);
    expect(
      checklistRules([{ ...rule, label: 'a'.repeat(80), target: 'b'.repeat(160) }]),
    ).toHaveLength(1);
  });

  test('un nom correspond au fichier ou chemin entier, jamais à un suffixe partiel', () => {
    const entries = [
      entry({ id: 0, path: 'root/README.md' }),
      entry({ id: 1, path: 'root/src/main.ts' }),
      entry({ id: 2, path: 'root/oldREADME.md' }),
      entry({ id: 3, path: 'root/other-src/main.ts' }),
    ];
    const items = customChecklist(entries, [
      { label: 'Instructions', kind: 'name', target: 'README.md' },
      { label: 'Entrée', kind: 'name', target: 'src/main.ts' },
      { label: 'Absent', kind: 'name', target: 'readme' },
    ]);
    expect(items.map((item) => item.status)).toEqual(['found', 'found', 'missing']);
    expect(items[0]!.files.map((file) => file.id)).toEqual([0]);
    expect(items[1]!.files.map((file) => file.id)).toEqual([1]);
    expect(items[0]!.description).toContain('Présence uniquement');
  });

  test('normalise Unicode, casse, chemins Windows et dossier sans faux préfixe', () => {
    const entries = [
      entry({ id: 0, path: 'Rendu\\E\u0301TUDES\\Note.TXT' }),
      entry({ id: 1, path: 'Rendu/études-bis/note.txt' }),
      entry({ id: 2, path: 'root/docs/assets/icon.svg' }),
    ];
    const items = customChecklist(entries, [
      { label: 'Note', kind: 'name', target: 'ÉTUDES\\note.txt' },
      { label: 'Dossier', kind: 'folder', target: '/Études/' },
      { label: 'Assets', kind: 'folder', target: 'docs/assets' },
      { label: 'Faux dossier', kind: 'folder', target: 'docs/asset' },
    ]);
    expect(items.map((item) => item.status)).toEqual(['found', 'found', 'found', 'missing']);
    expect(items[1]!.files.map((file) => file.id)).toEqual([0]);
    expect(items[2]!.files.map((file) => file.id)).toEqual([2]);
  });

  test('une extension accepte le point optionnel mais pas les sous-chaînes ni chemins', () => {
    const entries = [
      entry({ id: 0, path: 'root/app.TS' }),
      entry({ id: 1, path: 'root/script.ts.bak' }),
      entry({ id: 2, path: 'root/assets/archive.tar.gz' }),
    ];
    const items = customChecklist(entries, [
      { label: 'TS', kind: 'extension', target: 'ts' },
      { label: 'TS point', kind: 'extension', target: '.TS' },
      { label: 'Archive', kind: 'extension', target: 'tar.gz' },
      { label: 'Pas un chemin', kind: 'extension', target: 'assets/.gz' },
      { label: 'Cible vide normalisée', kind: 'name', target: '/' },
    ]);
    expect(items.map((item) => item.status)).toEqual([
      'found',
      'found',
      'found',
      'missing',
      'missing',
    ]);
    expect(items[0]!.files.map((file) => file.id)).toEqual([0]);
  });

  test('un dossier vide ne valide pas une règle qui demande du contenu', () => {
    const items = customChecklist(
      [entry({ path: 'root/docs/', directory: true })],
      [{ label: 'Documentation', kind: 'folder', target: 'docs' }],
    );
    expect(items[0]!.status).toBe('missing');
  });

  test('écarte chemins dangereux, liens et dépendances mais accepte un site déjà construit', () => {
    const entries = [
      entry({ id: 0, path: '../README.md' }),
      entry({ id: 1, path: 'root/node_modules/pkg/README.md' }),
      entry({ id: 2, path: 'root/.git/README.md' }),
      entry({ id: 3, path: 'root/__MACOSX/README.md' }),
      entry({ id: 4, path: 'root/.venv/README.md' }),
      entry({ id: 5, path: 'root/venv/README.md' }),
      entry({ id: 6, path: 'root/__pycache__/README.md' }),
      entry({ id: 7, path: 'root/README.md', symlink: true }),
      entry({ id: 8, path: 'root/README.md', directory: true }),
      entry({ id: 9, path: 'root/NODE_MODULES/pkg/README.md' }),
      entry({ id: 10, path: 'dist/index.html' }),
      entry({ id: 11, path: 'build/style.css' }),
    ];
    const items = customChecklist(entries, [
      { label: 'Instructions', kind: 'name', target: 'README.md' },
      { label: 'Site livré', kind: 'name', target: 'dist/index.html' },
      { label: 'Styles', kind: 'extension', target: 'css' },
    ]);
    expect(items.map((item) => item.status)).toEqual(['missing', 'found', 'found']);
    expect(items[1]!.files.map((file) => file.id)).toEqual([10]);
    expect(items[2]!.files.map((file) => file.id)).toEqual([11]);
  });

  test('le profil site web est utile sans configuration agents ou MCP', async () => {
    const analysis = await inspectArchive(
      zip({
        'site/index.html': '<!doctype html><title>Site</title>',
        'site/style.css': 'body { color: black; }',
        'site/app.js': 'console.log("site");',
        'site/README.md': 'Ouvrir index.html',
      }),
      'site.zip',
    );
    const items = checklist(analysis, 'web');
    expect(items.map((item) => item.id)).toEqual([
      'web-page',
      'web-style',
      'web-script',
      'web-readme',
    ]);
    expect(items.every((item) => item.status === 'found')).toBe(true);
    expect(items.some((item) => /MCP|OpenCode|Skills/.test(item.label))).toBe(false);
  });

  test('le profil site web accepte aussi les fichiers livrés dans dist ou build', async () => {
    const analysis = await inspectArchive(
      zip({ 'dist/index.html': '<title>Site livré</title>', 'build/assets/style.css': 'body{}' }),
      'site-construit.zip',
    );
    const items = checklist(analysis, 'web');
    expect(items.find((item) => item.id === 'web-page')!.status).toBe('found');
    expect(items.find((item) => item.id === 'web-style')!.status).toBe('found');
    expect(items.find((item) => item.id === 'web-script')!.status).toBe('missing');
  });

  test('le rapport exporte les règles choisies et masque leurs éventuels secrets', async () => {
    const analysis = await inspectArchive(zip({ 'docs/README.md': 'Instructions' }), 'docs.zip');
    const rules = [
      { label: 'Guide utilisateur', kind: 'name' as const, target: 'README.md' },
      {
        label: 'password=ArtificialLabelValue123',
        kind: 'name' as const,
        target: 'password=ArtificialTargetValue123',
      },
    ];
    const report = createReport(analysis, 'custom', [], rules);
    expect(report).toContain('Guide utilisateur');
    expect(report).toContain('Fichier attendu : README.md');
    expect(report).toContain('Repéré, exécution non vérifiée');
    expect(report).toContain('Non repéré');
    expect(report).not.toContain('ArtificialLabelValue123');
    expect(report).not.toContain('ArtificialTargetValue123');
    expect(report).not.toContain('Configuration OpenCode');
  });
});
