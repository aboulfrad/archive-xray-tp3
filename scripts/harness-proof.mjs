import { Validation } from '../.opencode/plugins/validation.js';
import assert from 'node:assert/strict';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
const hooks = await Validation({ directory: process.cwd() });
const before = hooks['tool.execute.before'];
await assert.rejects(() => before({ tool: 'read' }, { args: { filePath: '.env' } }), /secrets/);
await assert.rejects(
  () => before({ tool: 'read' }, { args: { filePath: '../other.txt' } }),
  /hors du projet/,
);
await assert.rejects(
  () => before({ tool: 'bash' }, { args: { command: 'npm test || true' } }),
  /masquer/,
);
await before({ tool: 'read' }, { args: { filePath: '.env.example' } });
const after = hooks['tool.execute.after'];
const temporary = 'src/harness-negative-fixture.ts';
let created = false;
try {
  await writeFile(temporary, 'export const invalid: number = "type error";\n', { flag: 'wx' });
  created = true;
  await assert.rejects(() => after({ tool: 'edit' }), /Typecheck bloquant/);
} finally {
  if (created) await unlink(temporary);
}
await after({ tool: 'edit' });
await mkdir('preuves', { recursive: true });
const proof = {
  time: new Date().toISOString(),
  scope:
    'Hooks appelés directement par un test de composant ; aucun déclenchement dans une session OpenCode revendiqué.',
  secretReadDenied: true,
  outsideProjectDenied: true,
  falseGreenDenied: true,
  realTypeErrorBlocked: true,
  validTypecheckAccepted: true,
};
await writeFile('preuves/harness.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof, null, 2));
