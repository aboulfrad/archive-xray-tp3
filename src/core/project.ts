import type {
  Annotation,
  ArchiveAnalysis,
  ArchiveEntry,
  ChecklistItem,
  ComparisonEntry,
  Profile,
} from './types';
import { customChecklist, type ChecklistRule } from './checklist';
import { redactText } from './inspect';
import { unsafePath } from './zip';

export function projectRoot(entries: ArchiveEntry[]): string {
  const paths = entries
    .filter((e) => !e.directory && !/^__MACOSX\//.test(e.path.replaceAll('\\', '/')))
    .map((e) => e.path.replaceAll('\\', '/'));
  const first = paths[0]?.split('/')[0];
  return first && paths.length && paths.every((p) => p.startsWith(`${first}/`)) ? `${first}/` : '';
}
export function relativePath(e: ArchiveEntry, entries: ArchiveEntry[]): string {
  const root = projectRoot(entries);
  const path = e.path.replaceAll('\\', '/');
  return (path.startsWith(root) ? path.slice(root.length) : path).normalize('NFC');
}
export function checklist(
  analysis: ArchiveAnalysis,
  profile: Profile,
  rules: ChecklistRule[] = [],
): ChecklistItem[] {
  if (profile === 'custom') return customChecklist(analysis.entries, rules);
  const fileEntries = analysis.entries.filter(
    (e) =>
      !e.directory &&
      !e.symlink &&
      !unsafePath(e.path) &&
      !(
        profile === 'web'
          ? /(^|\/)(node_modules|\.git|\.venv|venv|__pycache__|__MACOSX)(\/|$)/
          : /(^|\/)(node_modules|\.git|\.venv|venv|__pycache__|dist|build|__MACOSX)(\/|$)/
      ).test(e.path.replaceAll('\\', '/')),
  );
  const root = projectRoot(fileEntries);
  const add = (
    id: string,
    label: string,
    description: string,
    match: (path: string) => boolean,
    review = false,
  ): ChecklistItem => {
    const files = fileEntries.filter((e) =>
      match(e.path.replaceAll('\\', '/').slice(root.length).toLowerCase()),
    );
    return {
      id,
      label,
      description,
      files,
      status: files.length ? (review ? 'review' : 'found') : 'missing',
    };
  };
  const items = [
    add(
      'readme',
      'Instructions de lancement',
      'README repéré. La clarté et les commandes sont à vérifier à la lecture.',
      (p) => /(^|\/)readme(?:\.md|\.txt|\.rst)?$/.test(p),
    ),
    add(
      'manifest',
      'Description du projet',
      'Manifestes de dépendances ou fichier de construction.',
      (p) =>
        /(^|\/)(package\.json|pyproject\.toml|requirements\.txt|cargo\.toml|pom\.xml|go\.mod|composer\.json|makefile)$/.test(
          p,
        ),
    ),
    add(
      'tests',
      'Tests présents',
      'Présence de fichiers de tests ; aucun test du rendu n’est exécuté.',
      (p) => /\.(test|spec)\.[^/]+$|(^|\/)test_[^/]+\.py$|(^|\/)[^/]+_test\.go$|\.feature$/.test(p),
    ),
    add(
      'ci',
      'Intégration continue',
      'Configuration CI repérée ; son exécution distante n’est pas vérifiée.',
      (p) => /^\.github\/workflows\/[^/]+\.ya?ml$|^\.gitlab-ci\.yml$/.test(p),
    ),
    add(
      'lock',
      'Dépendances reproductibles',
      'Lockfile repéré ; cohérence avec le manifeste à vérifier.',
      (p) =>
        /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|uv\.lock|poetry\.lock|cargo\.lock|composer\.lock)$/.test(
          p,
        ),
    ),
  ];
  if (profile === 'web')
    return [
      add(
        'web-page',
        'Page d’accueil',
        'index.html ou index.htm repéré ; affichage à vérifier.',
        (p) => /(^|\/)index\.html?$/.test(p),
      ),
      add(
        'web-style',
        'Styles du site',
        'Feuilles CSS ou SCSS repérées ; elles peuvent être facultatives.',
        (p) => /\.(css|scss)$/.test(p),
      ),
      add(
        'web-script',
        'Scripts du site',
        'JavaScript ou TypeScript repéré ; facultatif pour un site statique.',
        (p) => /\.(js|mjs|ts|jsx|tsx)$/.test(p),
      ),
      add(
        'web-readme',
        'Instructions du site',
        'README repéré ; utile pour savoir lancer ou publier le site.',
        (p) => /(^|\/)readme(?:\.md|\.txt)?$/.test(p),
      ),
    ];
  if (profile !== 'project') {
    items.push(
      add('rules', 'Règles du projet', 'AGENTS.md ou règles de projet repérés.', (p) =>
        /(^|\/)agents\.md$|^\.opencode\/rules\//.test(p),
      ),
    );
    items.push(
      add(
        'config',
        'Configuration OpenCode / MCP',
        'Fichier repéré. Les connexions et l’usage effectif ne sont pas prouvés.',
        (p) => /(^|\/)(opencode\.jsonc?|\.mcp\.json)$/.test(p),
      ),
    );
    items.push(
      add(
        'skills',
        'Skills',
        'SKILL.md repéré ; chargement effectif à vérifier dans les preuves.',
        (p) => /(^|\/)skill\.md$/.test(p),
      ),
    );
    items.push(
      add(
        'captures',
        'Captures de preuve',
        'Images repérées dans un dossier captures, preuves ou screenshots.',
        (p) => /(^|\/)(captures|screenshots|preuves)\/.*\.(png|jpe?g|webp)$/.test(p),
      ),
    );
  }
  if (profile === 'tp2' || profile === 'tp3') {
    items.push(
      add(
        'agents',
        'Agents spécialisés',
        'Définitions de rôles repérées ; leurs droits et exécutions restent à vérifier.',
        (p) => /^\.(opencode|codex)\/agents?\/[^/]+\.(md|toml)$/.test(p),
      ),
    );
    items.push(
      add(
        'hooks',
        'Hooks et contrôles automatiques',
        'Hooks ou plugins repérés ; présence seule ne prouve pas le déclenchement.',
        (p) => /^\.(opencode\/plugins?|codex\/hooks|githooks|husky)\//.test(p),
      ),
    );
    items.push(
      add(
        'commands',
        'Commandes du harness',
        'Procédures repérées ; leur comportement reste à examiner.',
        (p) => /^\.opencode\/commands?\//.test(p),
      ),
    );
  }
  if (profile === 'tp1')
    items.push(
      add(
        'report',
        'Rapport de missions',
        'Rapport ou journal repéré ; exactitude des résultats à vérifier.',
        (p) => /(^|\/)(rapport|journal|journal_decisions)\.md$/.test(p),
      ),
    );
  return items;
}
export function harnessObservations(
  analysis: ArchiveAnalysis,
): { path: string; message: string; line?: number }[] {
  const result: { path: string; message: string; line?: number }[] = [];
  const add = (value: (typeof result)[number]) => {
    if (result.length < 150) result.push(value);
    else if (result.length === 150)
      result.push({
        path: 'archive',
        message: 'Liste abrégée : d’autres observations peuvent être présentes.',
      });
  };
  for (const e of analysis.entries) {
    if (result.length > 150) break;
    if (
      !e.text ||
      /(^|\/)(node_modules|\.git|\.venv|venv|__pycache__)(\/|$)/.test(e.path.replaceAll('\\', '/'))
    )
      continue;
    if (/(^|\/)package\.json$/.test(e.path.replaceAll('\\', '/'))) {
      try {
        const value: unknown = JSON.parse(e.text);
        if (
          value &&
          typeof value === 'object' &&
          'scripts' in value &&
          value.scripts &&
          typeof value.scripts === 'object'
        ) {
          for (const [key, command] of Object.entries(value.scripts)) {
            if (result.length > 150) break;
            if (
              typeof command === 'string' &&
              /(?:\|\|\s*true|exit\s+0|echo\s+.*(?:pass|success|ok))/i.test(command)
            )
              add({
                path: e.path,
                message: `Le script « ${key.slice(0, 120)}${key.length > 120 ? '…' : ''} » contient un motif pouvant masquer un échec. À examiner ; ce n’est pas une preuve de contournement.`,
              });
          }
        }
      } catch {
        add({
          path: e.path,
          message: 'Le manifeste package.json n’est pas un JSON valide.',
        });
      }
    }
    if (/\.(test|spec)\.|(^|\/)test_/.test(e.path.replaceAll('\\', '/'))) {
      const lines = e.text.split('\n');
      for (let i = 0; i < lines.length && result.length <= 150; i++) {
        const line = lines[i]!;
        if (/\b(?:test|it|describe)\.(?:skip|todo)\b|expect\(true\)\.toBe\(true\)/.test(line))
          add({
            path: e.path,
            line: i + 1,
            message:
              'Test ignoré, à écrire ou assertion triviale repéré. Vérifiez sa justification.',
          });
      }
    }
    if (/\.(ts|tsx)$/.test(e.path.replaceAll('\\', '/'))) {
      const lines = e.text.split('\n');
      for (let i = 0; i < lines.length && result.length <= 150; i++) {
        const line = lines[i]!;
        if (/@ts-nocheck/.test(line))
          add({
            path: e.path,
            line: i + 1,
            message: 'Vérification TypeScript désactivée dans ce fichier.',
          });
      }
    }
  }
  return result;
}
export function compareArchives(
  before: ArchiveAnalysis,
  after: ArchiveAnalysis,
): ComparisonEntry[] {
  const map = (a: ArchiveAnalysis) => {
    const result = new Map<string, ArchiveEntry>();
    const counts = new Map<string, number>();
    const files = a.entries.filter((e) => !e.directory);
    const root = projectRoot(a.entries);
    const relative = (e: ArchiveEntry) => {
      const path = e.path.replaceAll('\\', '/');
      return (path.startsWith(root) ? path.slice(root.length) : path).normalize('NFC');
    };
    for (const e of files) {
      const path = relative(e);
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
    for (const e of files) {
      const path = relative(e);
      result.set((counts.get(path) ?? 0) > 1 ? `${path} [entrée ${e.id}]` : path, e);
    }
    return result;
  };
  const left = map(before),
    right = map(after);
  return [...new Set([...left.keys(), ...right.keys()])].sort().map((path) => {
    const a = left.get(path),
      b = right.get(path);
    const identical =
      a &&
      b &&
      a.size === b.size &&
      a.crc === b.crc &&
      (a.text === undefined || b.text === undefined || a.text === b.text);
    return {
      path,
      before: a,
      after: b,
      state: !a ? 'added' : !b ? 'removed' : identical ? 'same' : 'changed',
    };
  });
}
export function createReport(
  analysis: ArchiveAnalysis,
  profile: Profile,
  annotations: Annotation[] = [],
  rules: ChecklistRule[] = [],
): string {
  const cell = (s: string) => {
    const text = redactText(s).replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', ' ');
    let longest = 0;
    for (const match of text.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
    const fence = '`'.repeat(longest + 1);
    return `${fence} ${text} ${fence}`;
  };
  const files = analysis.entries.filter((e) => !e.directory);
  const items = checklist(analysis, profile, rules);
  const lines = [
    '# Archive X-Ray — rapport d’inspection',
    '',
    `Archive : ${cell(analysis.name)}`,
    `Analyse : ${analysis.analyzedAt}`,
    `Profil : ${profile}`,
    '',
    '## Périmètre',
    `${files.length} fichiers inventoriés ; ${analysis.inspectedCount} contenus lus avec contrôle de taille et CRC.`,
    'Aucun code ni test de l’archive n’a été exécuté. Ce rapport n’est pas une certification de sécurité ni une note.',
    'Les secrets détectés ne sont pas reproduits. Les noms de fichiers et les annotations peuvent contenir des informations personnelles.',
    '',
    '## Checklist',
    '| Élément | Observation |',
    '|---|---|',
    ...items.map(
      (i) =>
        `| ${cell(i.label)}${profile === 'custom' ? ` — ${cell(i.description)}` : ''} | ${i.status === 'missing' ? 'Non repéré' : 'Repéré, exécution non vérifiée'} |`,
    ),
    '',
    '## Constats',
    ...(analysis.findings.length
      ? analysis.findings.map(
          (f) =>
            `- **${f.severity} — ${cell(f.title)}** : ${cell(f.path ?? 'archive')}${f.line ? `, ligne ${f.line}` : ''}. ${cell(f.detail)}`,
        )
      : [
          'Aucun signal détecté par les règles prises en charge. Cela ne garantit pas l’absence de risque.',
        ]),
    '',
    '## Contenus non analysés',
    ...files
      .filter((e) => !e.inspected)
      .map((e) => `- ${cell(e.path)} : ${cell(e.reason ?? 'non analysé')}`),
    '',
    '## Annotations',
    ...annotations.map(
      (a) =>
        `- ${cell(analysis.entries.find((e) => e.id === a.fileId)?.path ?? 'archive')}${a.line ? `:${a.line}` : ''} : ${cell(a.text)}`,
    ),
    '',
    '## Limites',
    '- ZIP classique, méthodes STORE et DEFLATE. ZIP64 et archives multi-volumes refusés.',
    '- 64 Mo compressés, 2 500 entrées et 256 Mo décompressés annoncés maximum.',
    '- Lecture limitée à 1 Mo par fichier et 12 Mo cumulés. Les dépendances et archives imbriquées ne sont pas lues.',
    '- Les règles de secrets sont heuristiques : faux positifs et faux négatifs possibles.',
    '- La comparaison de fichiers non lus utilise leur taille et CRC : elle ne prouve pas leur identité cryptographique.',
    '- Un fichier corrompu, chiffré, trop volumineux ou non pris en charge reste explicitement non analysé.',
    '- Les commentaires saisis par l’utilisateur ne sont pas validés par le moteur.',
    '',
  ];
  return lines.join('\n');
}
