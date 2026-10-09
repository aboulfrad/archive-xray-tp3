import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Columns2,
  FileCode2,
  FileText,
  FolderTree,
  Info,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  Minus,
  Plus,
  ScanLine,
  Search,
  ShieldCheck,
  ShieldX,
  X,
} from 'lucide-react';
import type {
  Annotation,
  ArchiveAnalysis,
  ArchiveEntry,
  Finding,
  Profile,
  Severity,
} from './core/types';
import { LIMITS } from './core/types';
import { checklist, compareArchives, createReport, harnessObservations } from './core/project';
import { unsafePath, visibleName } from './core/zip';
import { redactText } from './core/inspect';
import Preview from './components/Preview';
import FileTree from './components/FileTree';

type View = 'overview' | 'files' | 'findings' | 'checklist' | 'compare' | 'export' | 'about';
const navigation: { id: View; label: string; icon: typeof ScanLine }[] = [
  { id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { id: 'files', label: 'Explorateur', icon: FolderTree },
  { id: 'findings', label: 'Points d’attention', icon: ShieldCheck },
  { id: 'checklist', label: 'Checklist du rendu', icon: ClipboardCheck },
  { id: 'compare', label: 'Comparer deux ZIP', icon: Columns2 },
  { id: 'export', label: 'Rapport & export', icon: ArrowDownToLine },
];
const profileLabels: Record<Profile, string> = {
  project: 'Projet informatique',
  tp1: 'TP1 · MCP & skills',
  tp2: 'TP2 · Harness',
  tp3: 'TP3 · Projet final',
};
const kindLabels: Record<ArchiveEntry['kind'], string> = {
  code: 'Code source',
  config: 'Configuration',
  document: 'Documents',
  image: 'Images',
  archive: 'Archives',
  binary: 'Binaires',
  other: 'Autres',
};
export function formatBytes(value: number): string {
  if (!value) return '0 o';
  if (value < 1024) return `${value} o`;
  if (value < 1048576) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} Ko`;
  return `${(value / 1048576).toFixed(1)} Mo`;
}
function download(bytes: BlobPart, name: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Badge({ severity }: { severity: Severity }) {
  return (
    <span className={`severity ${severity}`}>
      {severity === 'critical' ? 'Bloquant' : severity === 'warning' ? 'À examiner' : 'Information'}
    </span>
  );
}
function FindingCard({
  finding,
  onOpen,
}: {
  finding: Finding;
  onOpen: (finding: Finding) => void;
}) {
  return (
    <button className={`finding-card ${finding.severity}`} onClick={() => onOpen(finding)}>
      <span className="finding-symbol">
        {finding.severity === 'critical' ? (
          <ShieldX size={20} />
        ) : finding.severity === 'warning' ? (
          <AlertTriangle size={20} />
        ) : (
          <Info size={20} />
        )}
      </span>
      <span className="finding-copy">
        <span className="finding-title">{finding.title}</span>
        <span className="finding-path" dir="ltr">
          {visibleName(finding.path ?? 'Archive')}
          {finding.line ? `:${finding.line}` : ''}
        </span>
        <span className="finding-detail">{finding.detail}</span>
      </span>
      <Badge severity={finding.severity} />
      <ChevronRight size={16} />
    </button>
  );
}
function DropZone({
  compact = false,
  onFile,
}: {
  compact?: boolean;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      className={`drop-zone ${compact ? 'compact' : ''} ${drag ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <div className="drop-icon">
        <Archive size={compact ? 25 : 36} />
        <span>
          <ScanLine size={16} />
        </span>
      </div>
      <h2>{compact ? 'Ajouter une seconde version' : 'Ouvrez votre ZIP, sans l’extraire.'}</h2>
      <p>
        {compact
          ? 'Les dossiers racines uniques sont normalisés pour la comparaison.'
          : 'Glissez votre rendu ici. Explorez les fichiers et examinez les points d’attention.'}
      </p>
      <button className="primary-button" onClick={() => input.current?.click()}>
        <Plus size={17} />
        {compact ? 'Choisir la seconde archive' : 'Choisir une archive'}
      </button>
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <span className="drop-limit">ZIP · 64 Mo maximum · aucune transmission de vos fichiers</span>
    </div>
  );
}
function LineComparison({ before, after }: { before: string; after: string }) {
  const a = redactText(before).split('\n'),
    b = redactText(after).split('\n');
  let prefix = 0,
    suffix = 0;
  while (prefix < Math.min(a.length, b.length) && a[prefix] === b[prefix]) prefix++;
  while (
    suffix < Math.min(a.length, b.length) - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  )
    suffix++;
  return (
    <div className="diff-panes">
      {[a, b].map((lines, side) => (
        <div key={side}>
          <div className="diff-heading">{side ? 'Nouvelle version' : 'Version précédente'}</div>
          <div className="diff-code">
            {lines.slice(0, 2000).map((line, i) => (
              <div
                key={i}
                className={
                  i >= prefix && i < lines.length - suffix
                    ? side
                      ? 'line-added'
                      : 'line-removed'
                    : ''
                }
              >
                <span>{i + 1}</span>
                <code>{line || ' '}</code>
              </div>
            ))}
            {lines.length > 2000 && <p>Aperçu limité à 2 000 lignes.</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [analysis, setAnalysis] = useState<ArchiveAnalysis>();
  const [second, setSecond] = useState<ArchiveAnalysis>();
  const [buffer, setBuffer] = useState<ArrayBuffer>();
  const [view, setView] = useState<View>('overview');
  const [selectedFile, setSelectedFile] = useState<ArchiveEntry>();
  const [focusLine, setFocusLine] = useState<number>();
  const [profile, setProfile] = useState<Profile>(() => {
    try {
      const p = localStorage.getItem('xray-profile');
      return p && Object.hasOwn(profileLabels, p) ? (p as Profile) : 'tp3';
    } catch {
      return 'tp3';
    }
  });
  const [busy, setBusy] = useState<string>();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [selectedExport, setSelectedExport] = useState<Set<number>>(new Set());
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [note, setNote] = useState('');
  const [comparisonPath, setComparisonPath] = useState<string>();
  const [onlyChanged, setOnlyChanged] = useState(true);
  const worker = useRef<Worker | undefined>(undefined);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const demoController = useRef<AbortController | undefined>(undefined);
  const operation = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      worker.current?.terminate();
      demoController.current?.abort();
      if (deadline.current) clearTimeout(deadline.current);
    },
    [],
  );
  useEffect(() => {
    try {
      localStorage.setItem('xray-profile', profile);
    } catch {
      /* Storage is optional. */
    }
  }, [profile]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(undefined), 4500);
    return () => clearTimeout(id);
  }, [notice]);
  const files = useMemo(() => analysis?.entries.filter((e) => !e.directory) ?? [], [analysis]);
  const counts = useMemo(
    () => ({
      critical: analysis?.findings.filter((f) => f.severity === 'critical').length ?? 0,
      warning: analysis?.findings.filter((f) => f.severity === 'warning').length ?? 0,
      info: analysis?.findings.filter((f) => f.severity === 'info').length ?? 0,
    }),
    [analysis],
  );
  const checks = useMemo(() => (analysis ? checklist(analysis, profile) : []), [analysis, profile]);
  const observations = useMemo(() => (analysis ? harnessObservations(analysis) : []), [analysis]);
  const comparison = useMemo(
    () => (analysis && second ? compareArchives(analysis, second) : []),
    [analysis, second],
  );
  const kinds = useMemo(
    () =>
      Object.entries(kindLabels)
        .map(([kind, label]) => ({
          kind,
          label,
          count: files.filter((e) => e.kind === kind).length,
          size: files.filter((e) => e.kind === kind).reduce((n, e) => n + e.size, 0),
        }))
        .filter((k) => k.count),
    [files],
  );
  function stop() {
    operation.current++;
    worker.current?.terminate();
    worker.current = undefined;
    demoController.current?.abort();
    if (deadline.current) clearTimeout(deadline.current);
    setBusy(undefined);
    setProgress(0);
  }
  function openFile(e: ArchiveEntry, line?: number) {
    setSelectedFile(e);
    setFocusLine(line);
    setView('files');
    setNote('');
  }
  function openFinding(f: Finding) {
    const e = analysis?.entries.find((e) => e.id === f.fileId);
    if (e) openFile(e, f.line);
  }
  function beginWorker(
    data: object,
    onResult: (data: { analysis?: ArchiveAnalysis; bytes?: Uint8Array }) => void,
  ) {
    worker.current?.terminate();
    const instance = new Worker(new URL('./archive.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = instance;
    deadline.current = setTimeout(() => {
      stop();
      setError('Opération interrompue après 20 secondes. Essayez une archive plus petite.');
    }, 20000);
    instance.onmessage = (
      event: MessageEvent<{
        type: string;
        message?: string;
        done?: number;
        total?: number;
        analysis?: ArchiveAnalysis;
        bytes?: Uint8Array;
      }>,
    ) => {
      if (event.data.type === 'progress') {
        setProgress(
          Math.round(((event.data.done ?? 0) / Math.max(1, event.data.total ?? 1)) * 100),
        );
        return;
      }
      if (deadline.current) clearTimeout(deadline.current);
      instance.terminate();
      worker.current = undefined;
      setBusy(undefined);
      if (event.data.type === 'error') setError(event.data.message ?? 'Opération interrompue.');
      else onResult(event.data);
    };
    instance.onerror = () => {
      stop();
      setError(
        'Le moteur d’analyse a rencontré une erreur. Vous pouvez réessayer avec une autre archive.',
      );
    };
    instance.postMessage(data);
  }
  async function load(file: File, compare = false) {
    stop();
    setError(undefined);
    setProgress(0);
    if (!/\.zip$/i.test(file.name)) {
      setError('Choisissez un fichier .zip. Les autres formats ne sont pas pris en charge.');
      return;
    }
    if (file.size > LIMITS.archiveBytes) {
      setError('Cette archive dépasse la limite de 64 Mo.');
      return;
    }
    setBusy(`Analyse de ${file.name}`);
    const currentOperation = operation.current;
    try {
      const bytes = await file.arrayBuffer();
      if (currentOperation !== operation.current) return;
      beginWorker({ type: 'inspect', buffer: bytes, name: file.name }, (result) => {
        if (!result.analysis) return;
        if (compare) {
          setSecond(result.analysis);
          setComparisonPath(undefined);
          setView('compare');
        } else {
          setAnalysis(result.analysis);
          setBuffer(bytes);
          setSecond(undefined);
          setAnnotations([]);
          setSelectedFile(undefined);
          setView('overview');
          const blocked = new Set(
            result.analysis.findings
              .filter(
                (f) =>
                  f.severity === 'critical' ||
                  f.rule === 'env' ||
                  f.rule.startsWith('secret-') ||
                  ['noise', 'macos', 'duplicate', 'path-conflict'].includes(f.rule),
              )
              .map((f) => f.fileId),
          );
          setSelectedExport(
            new Set(
              result.analysis.entries
                .filter(
                  (e) =>
                    !e.directory &&
                    !blocked.has(e.id) &&
                    !(e.flags & 1) &&
                    [0, 8].includes(e.method),
                )
                .map((e) => e.id),
            ),
          );
        }
        setNotice('Inventaire terminé. Consultez les limites et les points d’attention.');
      });
    } catch {
      if (currentOperation !== operation.current) return;
      stop();
      setError('Impossible de lire ce fichier. Sélectionnez-le de nouveau.');
    }
  }
  async function demo(which: string, compare = false) {
    stop();
    setError(undefined);
    setBusy('Ouverture de l’archive de démonstration');
    const controller = new AbortController();
    demoController.current = controller;
    try {
      const response = await fetch(`/demos/${which}.zip`, { signal: controller.signal });
      if (!response.ok) throw new Error('Demo unavailable');
      await load(
        new File([await response.blob()], `${which}.zip`, { type: 'application/zip' }),
        compare,
      );
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      stop();
      setError('La démonstration est indisponible. Vous pouvez importer votre ZIP.');
    }
  }
  function report() {
    if (!analysis) return;
    download(
      createReport(analysis, profile, annotations),
      `${analysis.name.replace(/\.zip$/i, '')}-rapport.md`,
    );
    setNotice('Rapport téléchargé. Les valeurs de secrets détectés ne sont pas incluses.');
  }
  function filtered() {
    if (!buffer || !analysis) return;
    setError(undefined);
    setBusy('Vérification et reconstruction de la sélection');
    setProgress(0);
    beginWorker(
      {
        type: 'export',
        buffer,
        entries: analysis.entries.map((e) => ({ ...e, text: undefined, bytes: undefined })),
        selected: [...selectedExport],
      },
      (result) => {
        if (result.bytes) {
          download(
            new Uint8Array(result.bytes),
            `${analysis.name.replace(/\.zip$/i, '')}-selection.zip`,
            'application/zip',
          );
          setNotice(
            'Copie filtrée téléchargée. Le contenu des fichiers conservés n’a pas été modifié.',
          );
        }
      },
    );
  }
  const selectedComparison = comparison.find((c) => c.path === comparisonPath);
  return (
    <div className="app-shell">
      <aside className="sidebar" inert={busy ? true : undefined}>
        <button
          className="brand"
          onClick={() => setView('overview')}
          aria-label="Archive X-Ray, accueil"
        >
          <span className="brand-symbol">
            <ScanLine size={23} />
          </span>
          <span>
            archive<span className="brand-light">xray</span>
            <small>LE ZIP, SOUS UN AUTRE ANGLE</small>
          </span>
        </button>
        <div className="sidebar-section">ESPACE D’INSPECTION</div>
        <nav>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? 'active' : ''}`}
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'findings' && analysis && counts.critical + counts.warning > 0 && (
                <span className="nav-count">{counts.critical + counts.warning}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-project">
          <span className="sidebar-section">ARCHIVE ACTIVE</span>
          {analysis ? (
            <>
              <div className="active-archive">
                <Archive size={18} />
                <span title={analysis.name}>{analysis.name}</span>
              </div>
              <small>
                {formatBytes(analysis.byteLength)} · {files.length} fichiers
              </small>
              <button className="quiet-button" onClick={() => input.current?.click()}>
                <Plus size={14} />
                Changer d’archive
              </button>
            </>
          ) : (
            <p>Aucune archive ouverte.</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="privacy-mini">
            <LockKeyhole size={16} />
            <span>
              Vos fichiers restent ici.<small>Analyse dans votre navigateur</small>
            </span>
          </div>
          <button
            className={`nav-item ${view === 'about' ? 'active' : ''}`}
            onClick={() => setView('about')}
          >
            <CircleHelp size={17} />
            Périmètre & confidentialité
          </button>
          <div className="version">
            ARCHIVE X-RAY <span>1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={busy ? true : undefined}>
        <header className="topbar">
          <div className="breadcrumb">
            Espace d’inspection
            <ChevronRight size={14} />
            <strong>
              {view === 'about' ? 'Périmètre' : navigation.find((n) => n.id === view)?.label}
            </strong>
          </div>
          <div className="top-actions">
            <span className="local-badge">
              <LockKeyhole size={13} />
              Traitement local
            </span>
            <button className="secondary-button" onClick={() => input.current?.click()}>
              <ArrowUpFromLine size={15} />
              Importer un ZIP
            </button>
          </div>
        </header>
        <input
          ref={input}
          type="file"
          accept=".zip"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void load(file);
            e.target.value = '';
          }}
        />
        <main className={`main-content ${view === 'files' ? 'workspace-content' : ''}`}>
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={19} />
              <span>{error}</span>
              <button aria-label="Fermer l’erreur" onClick={() => setError(undefined)}>
                <X size={17} />
              </button>
            </div>
          )}
          {!analysis && view !== 'about' ? (
            <div className="welcome">
              <div className="page-heading">
                <div>
                  <div className="eyebrow">INSPECTION AVANT EXTRACTION</div>
                  <h1>Voir ce que votre archive contient vraiment.</h1>
                  <p>
                    Un espace pour comprendre un projet, examiner ses fichiers et préparer sa
                    lecture.
                  </p>
                </div>
                <span className="outline-tag">Sans compte · Sans envoi</span>
              </div>
              <DropZone onFile={(file) => void load(file)} />
              <div className="demo-heading">
                <h3>Commencez avec un exemple</h3>
                <span>Archives fictives, anomalies préparées</span>
              </div>
              <div className="demo-grid">
                <button className="demo-card" onClick={() => void demo('projet-complet')}>
                  <span className="demo-card-icon green">
                    <FileCode2 size={22} />
                  </span>
                  <strong>Un projet complet</strong>
                  <p>README, code, tests et harness. Découvrez le parcours d’inspection.</p>
                  <span className="demo-footer">
                    Ouvrir la démonstration
                    <ChevronRight size={16} />
                  </span>
                </button>
                <button className="demo-card" onClick={() => void demo('archive-piegee')}>
                  <span className="demo-card-icon coral">
                    <ShieldX size={22} />
                  </span>
                  <strong>Une archive à examiner</strong>
                  <p>Chemins suspects, noms trompeurs et secret fictif. Retrouvez les indices.</p>
                  <span className="demo-footer">
                    Examiner les anomalies
                    <ChevronRight size={16} />
                  </span>
                </button>
                <button className="demo-card" onClick={() => void demo('rendu-incomplet')}>
                  <span className="demo-card-icon purple">
                    <ClipboardCheck size={22} />
                  </span>
                  <strong>Un rendu incomplet</strong>
                  <p>
                    Explorez la checklist et distinguez ce qui est présent de ce qui reste à
                    vérifier.
                  </p>
                  <span className="demo-footer">
                    Consulter la checklist
                    <ChevronRight size={16} />
                  </span>
                </button>
              </div>
              <div className="welcome-foot">
                <ShieldCheck size={17} />
                <span>
                  Inventaire et contrôles ciblés. Aucun code exécuté, aucune certification de
                  sécurité.
                </span>
              </div>
            </div>
          ) : view === 'about' ? (
            <div className="about-view">
              <div className="eyebrow">UNE ANALYSE EXPLICABLE</div>
              <h1>
                Ce que l’outil voit.
                <br />
                Et ce qu’il ne voit pas.
              </h1>
              <p className="lead">
                Archive X-Ray aide à consulter un ZIP avant de l’extraire. Ses constats sont des
                observations, pas une garantie de sécurité ou une note.
              </p>
              <div className="about-grid">
                <section className="panel">
                  <LockKeyhole />
                  <h3>Votre archive reste sur votre appareil</h3>
                  <p>
                    L’analyse, les aperçus, la recherche et les exports se font dans le navigateur.
                    Aucun fichier importé n’est envoyé au serveur. Seul votre choix de profil est
                    conservé localement.
                  </p>
                </section>
                <section className="panel">
                  <ShieldCheck />
                  <h3>Une lecture encadrée</h3>
                  <p>
                    64 Mo compressés, 2 500 entrées, 256 Mo décompressés annoncés. La lecture est
                    limitée à 1 Mo par fichier et 12 Mo cumulés. Une opération est arrêtée après 20
                    secondes.
                  </p>
                </section>
                <section className="panel">
                  <Search />
                  <h3>Des règles précises</h3>
                  <p>
                    Chemins dangereux, collisions de noms, liens symboliques, ratio de compression,
                    exécutables et quelques formats de secrets. Des faux positifs et faux négatifs
                    restent possibles.
                  </p>
                </section>
                <section className="panel">
                  <BookOpen />
                  <h3>Des limites visibles</h3>
                  <p>
                    ZIP64, archives multi-volumes et formats autres que ZIP sont refusés. Les
                    contenus chiffrés, archives imbriquées, dépendances et fichiers hors budget
                    restent non analysés.
                  </p>
                </section>
              </div>
              <section className="panel limitations">
                <h3>Quelques distinctions essentielles</h3>
                <ul>
                  <li>Un fichier présent n’est pas une preuve de son exécution.</li>
                  <li>Un manifeste ne prouve pas que ses dépendances s’installent.</li>
                  <li>Un fichier exécutable n’est pas nécessairement malveillant.</li>
                  <li>
                    Une copie filtrée ne retire pas les secrets présents dans les fichiers
                    conservés.
                  </li>
                  <li>
                    La comparaison utilise le texte lu, la taille et le CRC. Pour les autres
                    fichiers, ce n’est pas une preuve d’identité cryptographique.
                  </li>
                  <li>
                    Le rapport inclut les chemins et vos annotations : relisez-le avant de le
                    partager.
                  </li>
                </ul>
              </section>
            </div>
          ) : (
            analysis && (
              <>
                {view === 'overview' && (
                  <>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">RADIOGRAPHIE DU PROJET</div>
                        <h1 title={analysis.name}>{analysis.name}</h1>
                        <p>{files.length} fichiers inventoriés · aucune exécution du contenu</p>
                      </div>
                      <button className="secondary-button" onClick={report}>
                        <ArrowDownToLine size={16} />
                        Exporter le rapport
                      </button>
                    </div>
                    <div className="stat-grid">
                      <div className="stat-card">
                        <span>FICHIERS</span>
                        <strong>{files.length}</strong>
                        <small>{analysis.inspectedCount} contenus lus et contrôlés</small>
                        <FolderTree className="stat-icon" size={22} />
                      </div>
                      <div className="stat-card">
                        <span>VOLUME ANNONCÉ</span>
                        <strong>{formatBytes(analysis.totalSize)}</strong>
                        <small>{formatBytes(analysis.byteLength)} compressés</small>
                        <Archive className="stat-icon" size={22} />
                      </div>
                      <button
                        className="stat-card critical"
                        onClick={() => {
                          setFilter('critical');
                          setView('findings');
                        }}
                      >
                        <span>SIGNAUX BLOQUANTS</span>
                        <strong>{counts.critical}</strong>
                        <small>Lecture ou export à restreindre</small>
                        <ShieldX className="stat-icon" size={22} />
                      </button>
                      <button
                        className="stat-card warning"
                        onClick={() => {
                          setFilter('warning');
                          setView('findings');
                        }}
                      >
                        <span>À EXAMINER</span>
                        <strong>{counts.warning}</strong>
                        <small>Indices à contextualiser</small>
                        <AlertTriangle className="stat-icon" size={22} />
                      </button>
                    </div>
                    <div className="overview-grid">
                      <section className="panel composition">
                        <div className="section-heading">
                          <h3>Composition de l’archive</h3>
                          <span>Volumes annoncés</span>
                        </div>
                        <div className="composition-bar">
                          {kinds.map((k, i) => (
                            <div
                              key={k.kind}
                              className={`kind-${i}`}
                              title={`${k.label} : ${formatBytes(k.size)}`}
                              style={{ flex: Math.max(k.size, analysis.totalSize / 100) }}
                            />
                          ))}
                        </div>
                        <div className="kind-list">
                          {kinds.map((k, i) => (
                            <div key={k.kind}>
                              <span>
                                <i className={`kind-${i}`} />
                                {k.label}
                              </span>
                              <small>{k.count} fichiers</small>
                              <strong>{formatBytes(k.size)}</strong>
                            </div>
                          ))}
                        </div>
                      </section>
                      <section className="panel checklist-summary">
                        <div className="section-heading">
                          <h3>Préparer la lecture</h3>
                          <button className="quiet-button" onClick={() => setView('checklist')}>
                            Voir la checklist
                            <ChevronRight size={14} />
                          </button>
                        </div>
                        <label className="profile-select">
                          Profil du rendu
                          <select
                            value={profile}
                            onChange={(e) => setProfile(e.target.value as Profile)}
                          >
                            {Object.entries(profileLabels).map(([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="mini-checks">
                          {checks.slice(0, 5).map((c) => (
                            <button
                              key={c.id}
                              onClick={() =>
                                c.files[0] ? openFile(c.files[0]) : setView('checklist')
                              }
                            >
                              <span
                                className={c.status === 'missing' ? 'missing-icon' : 'found-icon'}
                              >
                                {c.status === 'missing' ? <Minus size={14} /> : <Check size={14} />}
                              </span>
                              <span>{c.label}</span>
                              <small>{c.status === 'missing' ? 'Non repéré' : 'Repéré'}</small>
                            </button>
                          ))}
                        </div>
                        <p className="panel-footnote">Présence repérée ≠ exécution vérifiée.</p>
                      </section>
                    </div>
                    <div className="section-heading lower-heading">
                      <h3>Points d’attention</h3>
                      <button
                        className="quiet-button"
                        onClick={() => {
                          setView('findings');
                          setFilter('all');
                        }}
                      >
                        Tout examiner
                        <ChevronRight size={15} />
                      </button>
                    </div>
                    <div className="finding-list">
                      {[...analysis.findings]
                        .sort(
                          (a, b) =>
                            ['critical', 'warning', 'info'].indexOf(a.severity) -
                            ['critical', 'warning', 'info'].indexOf(b.severity),
                        )
                        .slice(0, 4)
                        .map((f) => (
                          <FindingCard key={f.id} finding={f} onOpen={openFinding} />
                        ))}
                      {!analysis.findings.length && (
                        <div className="no-findings">
                          <CheckCheck size={22} />
                          <div>
                            <strong>Aucun signal détecté par les règles disponibles.</strong>
                            <p>
                              Certains contenus peuvent rester non analysés. Consultez le périmètre
                              avant de conclure.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="inspection-foot">
                      <Info size={15} />
                      {files.filter((e) => !e.inspected).length} contenus non lus ·{' '}
                      {formatBytes(analysis.contentBytes)} analysés · ZIP classique, STORE / DEFLATE
                    </div>
                  </>
                )}
                {view === 'files' && (
                  <div className="file-workspace">
                    <FileTree
                      analysis={analysis}
                      selected={selectedFile?.id}
                      onSelect={(e) => openFile(e)}
                    />
                    <div className="reader-panel">
                      {selectedFile ? (
                        <>
                          <div className="reader-heading">
                            <FileText size={17} />
                            <strong dir="ltr">{visibleName(selectedFile.path)}</strong>
                            <span>{formatBytes(selectedFile.size)}</span>
                          </div>
                          <div className="reader-body">
                            <Preview entry={selectedFile} focusLine={focusLine} />
                          </div>
                          <div className="annotation-bar">
                            <label>
                              <span>
                                Annotation du fichier{focusLine ? ` · ligne ${focusLine}` : ''}
                              </span>
                              <input
                                aria-label="Annotation du fichier"
                                placeholder="Votre observation…"
                                value={note}
                                maxLength={2000}
                                onChange={(e) => setNote(e.target.value)}
                              />
                            </label>
                            <button
                              className="secondary-button"
                              disabled={!note.trim()}
                              onClick={() => {
                                setAnnotations((current) => [
                                  ...current,
                                  { fileId: selectedFile.id, text: note.trim(), line: focusLine },
                                ]);
                                setNote('');
                                setNotice('Annotation ajoutée au rapport.');
                              }}
                            >
                              <Plus size={15} />
                              Ajouter
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="empty-reader">
                          <FolderTree size={42} />
                          <h3>Choisissez un fichier</h3>
                          <p>
                            Explorez le rendu sans extraire l’archive.
                            <br />
                            La recherche porte sur les noms et les contenus lus.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {view === 'findings' && (
                  <>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">CONSTATS ET PREUVES</div>
                        <h1>Points d’attention</h1>
                        <p>
                          Chaque signal possède une règle et un emplacement. Cliquez pour consulter
                          le fichier.
                        </p>
                      </div>
                    </div>
                    <div className="filter-bar">
                      {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
                        <button
                          key={f}
                          className={filter === f ? 'active' : ''}
                          onClick={() => setFilter(f)}
                        >
                          {f === 'all'
                            ? 'Tous les constats'
                            : f === 'critical'
                              ? 'Bloquants'
                              : f === 'warning'
                                ? 'À examiner'
                                : 'Informations'}
                          <span>{f === 'all' ? analysis.findings.length : counts[f]}</span>
                        </button>
                      ))}
                    </div>
                    <div className="finding-list">
                      {analysis.findings
                        .filter((f) => filter === 'all' || f.severity === filter)
                        .map((f) => (
                          <FindingCard key={f.id} finding={f} onOpen={openFinding} />
                        ))}
                      {!analysis.findings.some(
                        (f) => filter === 'all' || f.severity === filter,
                      ) && (
                        <div className="empty-state">
                          <ShieldCheck size={36} />
                          <h3>Aucun constat dans cette catégorie</h3>
                          <p>Cela ne garantit pas l’absence de risque dans l’archive.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {view === 'checklist' && (
                  <>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">PRÉPARER L’EXAMEN DU RENDU</div>
                        <h1>La présence, pas la promesse.</h1>
                        <p>
                          Retrouvez les éléments attendus. Leur qualité et leur exécution restent à
                          vérifier.
                        </p>
                      </div>
                      <select
                        className="standalone-select"
                        value={profile}
                        onChange={(e) => setProfile(e.target.value as Profile)}
                      >
                        {Object.entries(profileLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="checklist-grid">
                      {checks.map((c) => (
                        <section key={c.id} className={`check-card ${c.status}`}>
                          <div>
                            <span
                              className={c.status === 'missing' ? 'missing-icon' : 'found-icon'}
                            >
                              {c.status === 'missing' ? <Minus size={18} /> : <Check size={18} />}
                            </span>
                            <h3>{c.label}</h3>
                            <span className="tag">
                              {c.status === 'missing' ? 'Non repéré' : 'Repéré'}
                            </span>
                          </div>
                          <p>{c.description}</p>
                          {c.files.slice(0, 4).map((e) => (
                            <button className="file-link" key={e.id} onClick={() => openFile(e)}>
                              <FileText size={13} />
                              <span>{visibleName(e.path)}</span>
                              <ChevronRight size={12} />
                            </button>
                          ))}
                          {c.files.length > 4 && (
                            <small>Et {c.files.length - 4} autres fichiers.</small>
                          )}
                        </section>
                      ))}
                    </div>
                    <section className="panel observations">
                      <div className="section-heading">
                        <h3>Observations du code et du harness</h3>
                        <span>Règles statiques ciblées</span>
                      </div>
                      {observations.length ? (
                        observations.map((o, i) => (
                          <button
                            key={i}
                            className="observation-row"
                            onClick={() => {
                              const e = analysis.entries.find((e) => e.path === o.path);
                              if (e) openFile(e, o.line);
                            }}
                          >
                            <AlertTriangle size={17} />
                            <span>
                              <strong>{o.message}</strong>
                              <small>
                                {o.path}
                                {o.line ? `:${o.line}` : ''}
                              </small>
                            </span>
                            <ChevronRight size={15} />
                          </button>
                        ))
                      ) : (
                        <p>
                          Aucun motif signalé dans les contenus lus. Les droits effectifs,
                          connexions MCP et déclenchements des hooks ne sont pas vérifiés.
                        </p>
                      )}
                    </section>
                  </>
                )}
                {view === 'compare' && (
                  <>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">ENTRE DEUX RENDUS</div>
                        <h1>Ce qui a changé.</h1>
                        <p>
                          Comparez les chemins et contenus disponibles. Les fichiers non lus sont
                          comparés par taille et CRC.
                        </p>
                      </div>
                      {second && (
                        <button className="secondary-button" onClick={() => setSecond(undefined)}>
                          <Plus size={15} />
                          Changer la seconde version
                        </button>
                      )}
                    </div>
                    {!second ? (
                      <>
                        <DropZone compact onFile={(file) => void load(file, true)} />
                        <button
                          className="secondary-button"
                          style={{ marginTop: 16 }}
                          onClick={() => void demo('projet-version-2', true)}
                        >
                          Essayer la seconde version de démonstration
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="comparison-header">
                          <span>
                            <Archive size={15} />
                            {analysis.name}
                          </span>
                          <Columns2 size={18} />
                          <span>
                            <Archive size={15} />
                            {second.name}
                          </span>
                        </div>
                        <div className="comparison-stats">
                          {(['added', 'removed', 'changed', 'same'] as const).map((state) => (
                            <span key={state} className={state}>
                              <strong>{comparison.filter((c) => c.state === state).length}</strong>
                              {state === 'added'
                                ? 'ajoutés'
                                : state === 'removed'
                                  ? 'supprimés'
                                  : state === 'changed'
                                    ? 'modifiés'
                                    : 'sans différence repérée'}
                            </span>
                          ))}
                          <label>
                            <input
                              type="checkbox"
                              checked={onlyChanged}
                              onChange={(e) => setOnlyChanged(e.target.checked)}
                            />
                            Différences uniquement
                          </label>
                        </div>
                        <div className="compare-workspace">
                          <div className="comparison-files">
                            {comparison
                              .filter((c) => !onlyChanged || c.state !== 'same')
                              .map((c) => (
                                <button
                                  key={visibleName(c.path)}
                                  className={`${c.state} ${comparisonPath === c.path ? 'selected' : ''}`}
                                  onClick={() => setComparisonPath(c.path)}
                                >
                                  {c.state === 'added' ? (
                                    <Plus size={15} />
                                  ) : c.state === 'removed' ? (
                                    <Minus size={15} />
                                  ) : (
                                    <FileText size={15} />
                                  )}
                                  <span>{visibleName(c.path)}</span>
                                </button>
                              ))}
                            {!comparison.some((c) => !onlyChanged || c.state !== 'same') && (
                              <p className="empty-note">
                                Aucune différence repérée. L’identité des contenus non lus n’est pas
                                garantie.
                              </p>
                            )}
                          </div>
                          <div className="comparison-detail">
                            {selectedComparison ? (
                              <>
                                <div className="reader-heading">
                                  <FileText size={15} />
                                  <strong>{selectedComparison.path}</strong>
                                </div>
                                {selectedComparison.before?.text !== undefined ||
                                selectedComparison.after?.text !== undefined ? (
                                  <LineComparison
                                    before={selectedComparison.before?.text ?? ''}
                                    after={selectedComparison.after?.text ?? ''}
                                  />
                                ) : (
                                  <div className="empty-reader">
                                    <Columns2 size={35} />
                                    <h3>Comparaison des métadonnées</h3>
                                    <p>
                                      Avant : {formatBytes(selectedComparison.before?.size ?? 0)}
                                      <br />
                                      Après : {formatBytes(selectedComparison.after?.size ?? 0)}
                                    </p>
                                    <p>
                                      Aucun diff texte disponible pour ce format ou contenu non lu.
                                    </p>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="empty-reader">
                                <Columns2 size={38} />
                                <h3>Sélectionnez une différence</h3>
                                <p>
                                  Le dossier racine unique de chaque projet est retiré des chemins
                                  de comparaison.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
                {view === 'export' && (
                  <>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">UNE SYNTHÈSE À EMPORTER</div>
                        <h1>Rapport & copie filtrée</h1>
                        <p>
                          Conservez les constats et préparez une sélection de fichiers. Votre
                          archive d’origine est inchangée.
                        </p>
                      </div>
                    </div>
                    <div className="export-grid">
                      <section className="panel report-panel">
                        <span className="demo-card-icon green">
                          <FileText size={23} />
                        </span>
                        <h3>Rapport d’inspection</h3>
                        <p>
                          Checklist, constats, contenus non analysés, limites et vos annotations.
                          Les valeurs des secrets détectés ne sont pas incluses.
                        </p>
                        <div className="report-summary">
                          <span>{analysis.findings.length} constats</span>
                          <span>{checks.length} critères</span>
                          <span>{annotations.length} annotations</span>
                        </div>
                        <button className="primary-button" onClick={report}>
                          <ArrowDownToLine size={16} />
                          Télécharger le rapport .md
                        </button>
                        <small>Relisez les chemins et annotations avant de partager.</small>
                        {annotations.length > 0 && (
                          <div className="notes-list">
                            {annotations.map((a, i) => (
                              <div key={i}>
                                <span>
                                  <strong>
                                    {analysis.entries.find((e) => e.id === a.fileId)?.path}
                                  </strong>
                                  <p>{a.text}</p>
                                </span>
                                <button
                                  className="icon-button"
                                  aria-label="Supprimer l’annotation"
                                  onClick={() =>
                                    setAnnotations((current) => current.filter((_, j) => i !== j))
                                  }
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                      <section className="panel selection-panel">
                        <div className="section-heading">
                          <h3>Préparer une copie filtrée</h3>
                          <span>{selectedExport.size} sélectionnés</span>
                        </div>
                        <p>
                          Par défaut, les chemins bloqués, dépendances et fichiers à secrets
                          potentiels sont exclus. Les contenus conservés ne sont pas nettoyés.
                        </p>
                        <div className="button-group">
                          <button
                            className="quiet-button"
                            onClick={() => setSelectedExport(new Set())}
                          >
                            Tout désélectionner
                          </button>
                          <button
                            className="quiet-button"
                            onClick={() =>
                              setSelectedExport(
                                new Set(
                                  files
                                    .filter(
                                      (e) =>
                                        !unsafePath(e.path) &&
                                        !e.symlink &&
                                        !(e.flags & 1) &&
                                        [0, 8].includes(e.method) &&
                                        !(
                                          e.size > 65536 &&
                                          e.size / Math.max(1, e.compressedSize) > LIMITS.ratio
                                        ),
                                    )
                                    .map((e) => e.id),
                                ),
                              )
                            }
                          >
                            Sélectionner les entrées exportables
                          </button>
                        </div>
                        <div className="selection-list">
                          {files.map((e) => {
                            const blocked =
                              unsafePath(e.path) ||
                              e.symlink ||
                              Boolean(e.flags & 1) ||
                              ![0, 8].includes(e.method) ||
                              (e.size > 65536 &&
                                e.size / Math.max(1, e.compressedSize) > LIMITS.ratio);
                            return (
                              <label key={e.id} className={blocked ? 'blocked-selection' : ''}>
                                <input
                                  type="checkbox"
                                  checked={selectedExport.has(e.id)}
                                  disabled={blocked}
                                  onChange={() =>
                                    setSelectedExport((current) => {
                                      const next = new Set(current);
                                      if (next.has(e.id)) next.delete(e.id);
                                      else next.add(e.id);
                                      return next;
                                    })
                                  }
                                />
                                <span title={visibleName(e.path)}>{visibleName(e.path)}</span>
                                <small>{blocked ? 'Bloqué' : formatBytes(e.size)}</small>
                              </label>
                            );
                          })}
                        </div>
                        <div className="selection-footer">
                          <span>
                            {formatBytes(
                              files
                                .filter((e) => selectedExport.has(e.id))
                                .reduce((n, e) => n + e.size, 0),
                            )}{' '}
                            / 32 Mo maximum
                          </span>
                          <button
                            className="primary-button"
                            disabled={!selectedExport.size}
                            onClick={filtered}
                          >
                            <ArrowDownToLine size={16} />
                            Exporter la sélection
                          </button>
                        </div>
                      </section>
                    </div>
                  </>
                )}
              </>
            )
          )}
        </main>
        <footer className="app-footer">
          <span>
            <LockKeyhole size={12} />
            Aucune archive importée n’est envoyée au serveur.
          </span>
          <button onClick={() => setView('about')}>
            Périmètre de l’analyse
            <ChevronRight size={12} />
          </button>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
          <button aria-label="Fermer la notification" onClick={() => setNotice(undefined)}>
            <X size={14} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy-overlay">
          <section
            className="busy-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="busy-title"
          >
            <div className="scanner-ring">
              <ScanLine size={34} />
            </div>
            <div className="eyebrow">MOTEUR D’INSPECTION</div>
            <h2 id="busy-title">{busy}</h2>
            <p>
              Traitement dans un espace de travail du navigateur.
              <br />
              Vos fichiers ne quittent pas cet appareil.
            </p>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Progression de l’analyse"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div style={{ width: `${Math.max(progress, 4)}%` }} />
            </div>
            <span className="progress-label">
              <LoaderCircle size={14} />
              {progress ? `${progress} %` : 'Vérification de la structure…'}
            </span>
            <button
              autoFocus
              className="secondary-button"
              onClick={() => {
                stop();
                setNotice('Opération annulée.');
              }}
            >
              <X size={15} />
              Annuler
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
