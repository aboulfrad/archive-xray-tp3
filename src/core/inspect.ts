import { LIMITS, type ArchiveAnalysis, type ArchiveEntry, type Finding } from './types';
import { parseZip, readEntry, unsafePath } from './zip';
import { imagePreviewAllowed } from './image';

export function metadataFindings(entries: ArchiveEntry[]): Finding[] {
  const findings: Finding[] = [];
  const names = new Map<string, ArchiveEntry>();
  const add = (
    e: ArchiveEntry,
    rule: string,
    severity: Finding['severity'],
    title: string,
    detail: string,
  ) => {
    findings.push({
      id: `${e.id}:${rule}`,
      rule,
      severity,
      title,
      detail,
      fileId: e.id,
      path: e.path,
    });
  };
  for (const e of entries) {
    if (unsafePath(e.path))
      add(
        e,
        'unsafe-path',
        'critical',
        'Chemin d’extraction dangereux',
        'Ce chemin peut sortir du dossier prévu ou possède une syntaxe ambiguë. Il est bloqué pour la lecture et l’export.',
      );
    if (e.symlink)
      add(
        e,
        'symlink',
        'critical',
        'Lien symbolique dans l’archive',
        'Un lien peut rediriger vers une autre destination. Son contenu n’est pas lu et il ne peut pas être exporté.',
      );
    if (e.flags & 1)
      add(
        e,
        'encrypted',
        'warning',
        'Contenu chiffré non inspectable',
        'Le nom et les métadonnées sont visibles ; le contenu ne peut pas être contrôlé.',
      );
    if (![0, 8].includes(e.method))
      add(
        e,
        'compression',
        'warning',
        'Compression non prise en charge',
        `La méthode ${e.method} n’est pas décodée. Le contenu reste non analysé.`,
      );
    if (e.size / Math.max(1, e.compressedSize) > LIMITS.ratio && e.size > 64 * 1024)
      add(
        e,
        'ratio',
        'critical',
        'Expansion disproportionnée',
        'Le rapport de compression dépasse 200:1. La décompression et l’export de ce fichier sont bloqués. Ce signal ne prouve pas à lui seul une attaque.',
      );
    if (/[\u202a-\u202e\u2066-\u2069\u200b-\u200f\ufeff]/u.test(e.path.replaceAll('\\', '/')))
      add(
        e,
        'unicode',
        'warning',
        'Caractères de nom trompeurs',
        'Le nom contient un caractère invisible ou modifiant le sens d’affichage. Vérifiez son nom réel.',
      );
    if (
      /\.(pdf|png|jpe?g|txt|docx|xlsx)\.(exe|com|bat|cmd|ps1|sh|js)$/i.test(
        e.path.replaceAll('\\', '/'),
      )
    )
      add(
        e,
        'double-extension',
        'warning',
        'Double extension trompeuse',
        'L’extension finale détermine le type réel. Un nom évoquant un document peut masquer un programme.',
      );
    if (e.executable)
      add(
        e,
        'executable',
        'warning',
        'Fichier exécutable ou script',
        'L’extension ou les permissions indiquent un fichier pouvant être exécuté. Sa présence peut être légitime ; aucun fichier n’est exécuté ici.',
      );
    if (
      /(^|\/)\.env(?:\.[^/]*)?$/.test(e.path.replaceAll('\\', '/')) &&
      !/\.(example|sample|template)$/.test(e.path.replaceAll('\\', '/'))
    )
      add(
        e,
        'env',
        'warning',
        'Fichier d’environnement à examiner',
        'Ce fichier peut contenir des identifiants. Vérifiez son contenu avant de partager le rendu.',
      );
    if (
      /(^|\/)(node_modules|\.git|\.venv|venv|__pycache__|dist|build)(\/|$)/.test(
        e.path.replaceAll('\\', '/'),
      )
    )
      add(
        e,
        'noise',
        'info',
        'Dépendance, historique ou fichier généré',
        'Ce contenu peut alourdir le rendu. Vérifiez s’il est nécessaire avant de l’exclure.',
      );
    if (/(^|\/)(__MACOSX)(\/|$)|(^|\/)\.DS_Store$/.test(e.path.replaceAll('\\', '/')))
      add(
        e,
        'macos',
        'info',
        'Métadonnée macOS',
        'Ce fichier est généralement inutile pour consulter le projet.',
      );
    if (e.kind === 'archive')
      add(
        e,
        'nested',
        'info',
        'Archive imbriquée non analysée',
        'Les archives internes ne sont pas ouvertes récursivement. Leur contenu n’entre pas dans cette analyse.',
      );
    const canonical = e.path
      .replaceAll('\\', '/')
      .normalize('NFC')
      .toLocaleLowerCase('en-US')
      .replace(/\/+$/, '');
    const previous = names.get(canonical);
    if (previous)
      add(
        e,
        'duplicate',
        'warning',
        'Chemin en collision',
        `Une autre entrée porte le même chemin ou un nom équivalent sur certains systèmes : ${previous.path}. L’export exige des chemins uniques.`,
      );
    else names.set(canonical, e);
  }
  for (const e of entries) {
    const canonical = e.path.replaceAll('\\', '/').normalize('NFC').toLowerCase();
    for (
      let slash = canonical.indexOf('/');
      slash !== -1;
      slash = canonical.indexOf('/', slash + 1)
    ) {
      const parent = names.get(canonical.slice(0, slash));
      if (parent && !parent.directory) {
        add(
          e,
          'path-conflict',
          'warning',
          'Conflit entre fichier et dossier',
          `Un fichier occupe le chemin parent ${parent.path}. Ces deux fichiers ne peuvent pas être exportés ensemble.`,
        );
        break;
      }
    }
  }
  return findings;
}
export function secretFindings(entry: ArchiveEntry): Finding[] {
  if (!entry.text) return [];
  const findings: Finding[] = [];
  const lines = entry.text.split('\n');
  const patterns: [string, RegExp][] = [
    [
      'token',
      /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{24,})\b/,
    ],
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    [
      'credential',
      /\b(?:password|passwd|api[_-]?key|secret|access[_-]?token|auth[_-]?token)\b["']?\s*[:=]\s*["']?([^\s"'`;,}]{8,})/i,
    ],
    ['connection', /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:/]+:[^\s@/]+@/i],
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const [rule, pattern] of patterns) {
      const match = pattern.exec(line);
      if (!match) continue;
      const value = match[1] ?? match[0];
      if (
        /^(?:example|sample|placeholder|changeme|your[_-]|replace[_-]|fake|demo|test|process\.env|\$\{|\{env:|<|undefined|xxxxxxxx)/i.test(
          value,
        )
      )
        continue;
      findings.push({
        id: `${entry.id}:secret:${i}:${rule}`,
        rule: `secret-${rule}`,
        severity: 'warning',
        title: 'Secret potentiel dans le contenu',
        detail:
          'Une règle de détection correspond à cette ligne. Vérifiez s’il s’agit d’un vrai secret ou d’un exemple. Les rapports ne contiennent pas sa valeur.',
        fileId: entry.id,
        path: entry.path,
        line: i + 1,
        evidence: '[valeur masquée]',
      });
      break;
    }
  }
  return findings;
}
export function redactText(text: string): string {
  const parts: string[] = [];
  let depth = 0,
    cursor = 0;
  // Scan markers once; repeated unclosed BEGIN markers must not cause quadratic backtracking.
  for (const marker of text.matchAll(/-----(BEGIN|END) (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g)) {
    if (marker[1] === 'BEGIN') {
      if (depth === 0) parts.push(text.slice(cursor, marker.index));
      depth++;
    } else if (depth > 0) {
      depth--;
      if (depth === 0) {
        parts.push('[CLÉ PRIVÉE MASQUÉE]');
        cursor = marker.index + marker[0].length;
      }
    }
  }
  parts.push(depth > 0 ? '[CLÉ PRIVÉE MASQUÉE]' : text.slice(cursor));
  return parts
    .join('')
    .replace(
      /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{24,})\b/g,
      '[TOKEN MASQUÉ]',
    )
    .replace(
      /(\b(?:password|passwd|api[_-]?key|secret|access[_-]?token|auth[_-]?token)\b["']?\s*[:=]\s*["']?)([^\s"'`;,}]{8,})/gi,
      '$1[VALEUR MASQUÉE]',
    )
    .replace(
      /((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:/]+:)[^\s@/]+@/gi,
      '$1[MASQUÉ]@',
    );
}
function magic(bytes: Uint8Array, path: string): string | undefined {
  const head = Array.from(bytes.subarray(0, 12));
  if (head[0] === 0x4d && head[1] === 0x5a && !/\.(exe|dll)$/i.test(path))
    return 'Signature de programme Windows (MZ) malgré une autre extension.';
  if (head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46)
    return 'Signature de programme ELF. Ce contenu n’est jamais exécuté.';
  if (
    /\.png$/i.test(path) &&
    !(
      head[0] === 137 &&
      head[1] === 80 &&
      head[2] === 78 &&
      head[3] === 71 &&
      head[4] === 13 &&
      head[5] === 10 &&
      head[6] === 26 &&
      head[7] === 10
    )
  )
    return 'La signature ne correspond pas à une image PNG.';
  if (/\.jpe?g$/i.test(path) && !(head[0] === 255 && head[1] === 216 && head[2] === 255))
    return 'La signature ne correspond pas à une image JPEG.';
  if (/\.gif$/i.test(path) && !new TextDecoder().decode(bytes.subarray(0, 6)).match(/^GIF8[79]a$/))
    return 'La signature ne correspond pas à une image GIF.';
  if (
    /\.webp$/i.test(path) &&
    !(
      new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP'
    )
  )
    return 'La signature ne correspond pas à une image WebP.';
  return undefined;
}
export async function inspectArchive(
  buffer: Uint8Array,
  name: string,
  progress?: (done: number, total: number) => void,
): Promise<ArchiveAnalysis> {
  const entries = parseZip(buffer);
  const findings = metadataFindings(entries);
  let contentBytes = 0,
    inspectedCount = 0;
  const blocked = new Set(findings.filter((f) => f.severity === 'critical').map((f) => f.fileId));
  const priority = [...entries].sort((a, b) => {
    const important = (e: ArchiveEntry) =>
      /(^|\/)(readme[^/]*|package\.json|opencode\.json|agents\.md|skill\.md|\.env[^/]*)$/i.test(
        e.path.replaceAll('\\', '/'),
      )
        ? 0
        : e.kind === 'code' || e.kind === 'config'
          ? 1
          : 2;
    return important(a) - important(b) || a.size - b.size;
  });
  for (let i = 0; i < priority.length; i++) {
    const e = priority[i]!;
    if (e.directory) {
      e.reason = 'Dossier';
      continue;
    }
    if (blocked.has(e.id)) e.reason = 'Lecture bloquée par un contrôle de sécurité';
    else if (e.flags & 1) e.reason = 'Contenu chiffré';
    else if (![0, 8].includes(e.method)) e.reason = 'Compression non prise en charge';
    else if (e.kind === 'archive') e.reason = 'Archive imbriquée';
    else if (e.size > LIMITS.previewBytes) e.reason = 'Fichier supérieur à 1 Mo';
    else if (contentBytes + e.size > LIMITS.contentBudget)
      e.reason = 'Budget de lecture de 12 Mo atteint';
    else if (
      /(^|\/)(node_modules|\.git|\.venv|venv|__pycache__)(\/|$)/.test(e.path.replaceAll('\\', '/'))
    )
      e.reason = 'Dépendances ou historique exclus de la lecture';
    else {
      try {
        const bytes = readEntry(buffer, e);
        contentBytes += bytes.length;
        const mismatch = magic(bytes, e.path);
        if (mismatch)
          findings.push({
            id: `${e.id}:magic`,
            rule: 'magic',
            severity: 'warning',
            title: 'Signature de fichier à examiner',
            detail: mismatch,
            fileId: e.id,
            path: e.path,
          });
        const isText =
          ['code', 'document', 'config'].includes(e.kind) ||
          /\.svg$/i.test(e.path.replaceAll('\\', '/'));
        if (isText && !bytes.subarray(0, 4096).includes(0)) {
          try {
            e.text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
          } catch {
            e.reason = 'Encodage texte autre que UTF-8';
          }
        } else if (
          e.kind === 'image' &&
          !mismatch &&
          /\.(png|jpe?g|gif|webp)$/i.test(e.path.replaceAll('\\', '/'))
        ) {
          if (imagePreviewAllowed(bytes, e.path)) e.bytes = bytes;
          else {
            e.reason =
              'Aperçu refusé : dimensions inconnues ou supérieures à 4 millions de pixels / 8192 px';
            findings.push({
              id: `${e.id}:image-bounds`,
              rule: 'image-bounds',
              severity: 'warning',
              title: 'Dimensions d’image non acceptées',
              detail: e.reason,
              fileId: e.id,
              path: e.path,
            });
          }
        }
        if (!e.text && !e.bytes && !e.reason && bytes.length) e.reason = 'Format sans aperçu';
        e.inspected = true;
        inspectedCount++;
        findings.push(...secretFindings(e));
      } catch (error) {
        e.reason = 'Contenu corrompu ou décompression bloquée';
        findings.push({
          id: `${e.id}:read`,
          rule: 'read-error',
          severity: 'critical',
          title: 'Lecture du contenu interrompue',
          detail: error instanceof Error ? error.message : 'Erreur de lecture.',
          fileId: e.id,
          path: e.path,
        });
      }
    }
    progress?.(i + 1, priority.length);
  }
  return {
    name,
    byteLength: buffer.length,
    analyzedAt: new Date().toISOString(),
    entries,
    findings,
    totalSize: entries.reduce((sum, e) => sum + e.size, 0),
    contentBytes,
    inspectedCount,
  };
}
