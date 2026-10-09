import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const probe = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' });
if (probe.status !== 0 || path.resolve(probe.stdout.trim()) !== root) {
  console.log('Hooks : aucun dépôt Git propre à ce projet, installation ignorée.');
} else {
  const existing = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout.trim();
  if (existing && existing !== '.githooks') console.log('Hook Git existant conservé :', existing);
  else {
    const set = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
      cwd: root,
      stdio: 'inherit',
    });
    if (set.status !== 0) process.exit(set.status ?? 1);
    console.log('Hook pre-commit strict installé.');
  }
}
