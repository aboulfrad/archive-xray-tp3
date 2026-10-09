import type { ArchiveEntry, ChecklistItem } from './types';
import { unsafePath } from './zip';

export interface ChecklistRule {
  label: string;
  kind: 'name' | 'extension' | 'folder';
  target: string;
}
export const MAX_CHECKLIST_RULES = 20;
export function checklistRules(value: unknown): ChecklistRule[] {
  if (!Array.isArray(value)) return [];
  const result: ChecklistRule[] = [];
  for (const rule of value.slice(0, MAX_CHECKLIST_RULES)) {
    if (!rule || typeof rule !== 'object') continue;
    const { label, kind, target } = rule as Record<string, unknown>;
    if (
      typeof label !== 'string' ||
      typeof target !== 'string' ||
      typeof kind !== 'string' ||
      !['name', 'extension', 'folder'].includes(kind) ||
      !label.trim() ||
      label.length > 80 ||
      !target.trim() ||
      target.length > 160 ||
      Array.from(label + target).some(
        (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
      )
    )
      continue;
    result.push({
      label: label.trim(),
      kind: kind as ChecklistRule['kind'],
      target: target.trim(),
    });
  }
  return result;
}
export function customChecklist(entries: ArchiveEntry[], rules: ChecklistRule[]): ChecklistItem[] {
  const files = entries.filter(
    (e) =>
      !e.directory &&
      !e.symlink &&
      !unsafePath(e.path) &&
      !/(^|\/)(node_modules|\.git|\.venv|venv|__pycache__|__macosx)(\/|$)/.test(
        e.path.replaceAll('\\', '/').normalize('NFC').toLowerCase(),
      ),
  );
  const normalized = files.map((file) => ({
    file,
    path: file.path.replaceAll('\\', '/').normalize('NFC').toLowerCase(),
  }));
  return checklistRules(rules).map((rule, i) => {
    const target = rule.target
      .replaceAll('\\', '/')
      .normalize('NFC')
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '');
    const matches = target
      ? normalized
          .filter(({ path }) => {
            if (rule.kind === 'name') return path === target || path.endsWith('/' + target);
            if (rule.kind === 'extension') {
              const extension = target.startsWith('.') ? target : '.' + target;
              return !extension.includes('/') && path.split('/').at(-1)!.endsWith(extension);
            }
            return path.startsWith(target + '/') || path.includes('/' + target + '/');
          })
          .map(({ file }) => file)
      : [];
    return {
      id: `custom-${i}`,
      label: rule.label,
      description: `${rule.kind === 'name' ? 'Fichier' : rule.kind === 'extension' ? 'Extension' : 'Dossier'} attendu : ${rule.target}. Présence uniquement ; contenu et qualité à vérifier.`,
      status: matches.length ? 'found' : 'missing',
      files: matches,
    };
  });
}
