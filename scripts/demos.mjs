import { mkdir, writeFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
const out = new URL('../public/demos/', import.meta.url);
await mkdir(out, { recursive: true });
const complete = {
  'README.md':
    '# Atelier météo\n\nProjet fictif de démonstration.\n\n## Démarrer\n```sh\nnpm ci\nnpm run dev\n```\n\n## Vérifier\n```sh\nnpm run check\n```\n\nLes configurations présentes ne prouvent pas leur exécution.\n',
  'package.json': JSON.stringify(
    {
      name: 'atelier-meteo',
      private: true,
      scripts: {
        dev: 'vite',
        test: 'vitest run',
        lint: 'eslint .',
        check: 'npm run lint && npm test',
      },
    },
    null,
    2,
  ),
  'package-lock.json': '{"name":"atelier-meteo","lockfileVersion":3,"packages":{}}',
  'src/temperature.ts':
    'export function celsiusToFahrenheit(celsius: number): number {\n  return celsius * 9 / 5 + 32;\n}\n',
  'test/temperature.spec.ts':
    "import { expect, test } from 'vitest';\nimport { celsiusToFahrenheit } from '../src/temperature';\ntest('point de congélation', () => {\n  expect(celsiusToFahrenheit(0)).toBe(32);\n});\n",
  '.github/workflows/ci.yml':
    'name: checks\non: [push]\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 24\n      - run: npm ci\n      - run: npm run check\n',
  'AGENTS.md': '# Règles\nLire le cahier des charges. Les échecs bloquent la livraison.\n',
  'opencode.json': '{"$schema":"https://opencode.ai/config.json","mcp":{}}',
  '.opencode/agent/review.md':
    '---\ndescription: Inspection sans modification\nmode: subagent\npermission:\n  edit: deny\n  bash: deny\n---\nVérifier les preuves.\n',
  '.opencode/command/check.md': 'Lancer npm run check et conserver le résultat exact.\n',
  '.opencode/plugin/checks.js':
    'export const Checks = async () => ({ /* exemple fictif, aucune exécution prouvée */ });\n',
  '.agents/skills/validation/SKILL.md':
    '---\nname: validation\ndescription: Vérifier un rendu\n---\nExiger des résultats de tests réels.\n',
  'captures/exemple.png': new Uint8Array(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1kAAAAASUVORK5CYII=',
      'base64',
    ),
  ),
  '.env.example': 'API_KEY=your_key_here\n',
};
async function save(name, data, root = '') {
  const entries = Object.create(null);
  for (const [path, value] of Object.entries(data))
    entries[root + path] = typeof value === 'string' ? strToU8(value) : value;
  await writeFile(new URL(name + '.zip', out), zipSync(entries, { level: 0 }));
}
await save('projet-complet', complete, 'atelier-meteo/');
const revised = {
  ...complete,
  'src/temperature.ts':
    'export function celsiusToFahrenheit(celsius: number): number {\n  if (!Number.isFinite(celsius)) throw new Error("Température invalide");\n  return celsius * 9 / 5 + 32;\n}\n',
  'src/validation.ts': 'export const isValid = (value: number) => Number.isFinite(value);\n',
};
delete revised['captures/exemple.png'];
await save('projet-version-2', revised, 'atelier-meteo-v2/');
await save(
  'rendu-incomplet',
  {
    'src/main.ts': 'console.log("Bonjour");\n',
    'package.json': '{"scripts":{"test":"echo success","lint":"eslint . || true"}}',
    'test/faux.spec.ts': 'test.skip("à écrire", () => {});\nexpect(true).toBe(true);\n',
    'src/legacy.ts': '// @ts-nocheck\nexport const unfinished = true;\n',
  },
  'rendu/',
);
await save('archive-piegee', {
  'README.md':
    '# Archive pédagogique\n\nTous les pièges sont fictifs : aucun malware réel.\nLe secret est un motif synthétique volontaire.\n',
  '../sortie.txt': 'Tentative fictive de sortie du dossier.\n',
  'rapport.pdf.exe': 'MZ — texte de démonstration, aucun programme réel.',
  '.env': 'API_KEY=illustrationOnly123456789\n',
  'image.png': 'Ce fichier n’est pas une image PNG.',
  'docs/notice\u202e.txt': 'Nom contenant un caractère de sens de lecture.\n',
  'src/README.md':
    '![Image externe](https://example.invalid/pixel)\n<script>alert("Jamais exécuté")</script>\n',
  'README.MD': 'Collision de casse avec README.md.\n',
  'node_modules/exemple/index.js': '// Dépendance inutile dans un rendu\n',
  '__MACOSX/._README.md': 'Métadonnée fictive\n',
  'suite.zip': zipSync({ 'invisible.txt': strToU8('Archive interne non inspectée') }, { level: 0 }),
  'src/index.ts': 'export const answer = 42;\n',
});
console.log('4 archives fictives générées dans public/demos.');
