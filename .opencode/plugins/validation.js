import { appendFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

export const Validation = async ({ directory }) => ({
  'tool.execute.before': async (input, output) => {
    const path = output.args?.filePath ?? output.args?.path;
    if (typeof path === 'string') {
      const absolute = resolve(directory, path);
      if (!absolute.startsWith(resolve(directory) + sep))
        throw new Error('Accès hors du projet refusé.');
      if (/(^|[/\\])\.env(?:\.[^/\\]+)?$/.test(absolute) && !absolute.endsWith('.env.example'))
        throw new Error('Lecture ou modification de secrets refusée.');
    }
    if (input.tool === 'bash' && /(?:\|\|\s*true|\bexit\s+0\b)/.test(output.args?.command ?? ''))
      throw new Error('Commande susceptible de masquer un échec refusée.');
  },
  'tool.execute.after': async (input) => {
    if (!['write', 'edit', 'apply_patch'].includes(input.tool)) return;
    const result = spawnSync('npm', ['run', 'typecheck'], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 30000,
    });
    appendFileSync(
      resolve(directory, 'preuves/harness-events.jsonl'),
      JSON.stringify({
        time: new Date().toISOString(),
        event: 'post-edit-typecheck',
        tool: input.tool,
        status: result.status,
      }) + '\n',
    );
    if (result.status !== 0)
      throw new Error(
        `Typecheck bloquant après modification : ${result.stderr || result.stdout || result.error?.message}`,
      );
  },
});
