import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  Search,
} from 'lucide-react';
import { visibleName } from '../core/zip';
import type { ArchiveAnalysis, ArchiveEntry } from '../core/types';

interface Node {
  name: string;
  path: string;
  children: Node[];
  entry?: ArchiveEntry;
}
function tree(entries: ArchiveEntry[]) {
  const root: Node = { name: '', path: '', children: [] };
  for (const entry of entries) {
    const parts = entry.path.replaceAll('\\', '/').split('/').filter(Boolean);
    let parent = root;
    parts.forEach((name, i) => {
      const path = parts.slice(0, i + 1).join('/');
      let child = parent.children.find(
        (c) => c.name === name && (i !== parts.length - 1 || !c.entry || c.entry.directory),
      );
      if (!child) {
        child = { name, path, children: [] };
        parent.children.push(child);
      }
      if (i === parts.length - 1) child.entry = entry;
      parent = child;
    });
  }
  function sort(node: Node) {
    node.children.sort(
      (a, b) =>
        Number(Boolean(b.children.length || b.entry?.directory)) -
          Number(Boolean(a.children.length || a.entry?.directory)) || a.name.localeCompare(b.name),
    );
    node.children.forEach(sort);
  }
  sort(root);
  return root;
}
export function FileIcon({ entry, size = 16 }: { entry: ArchiveEntry; size?: number }) {
  return entry.kind === 'image' ? (
    <FileImage size={size} />
  ) : entry.kind === 'code' || entry.kind === 'config' ? (
    <FileCode2 size={size} />
  ) : (
    <FileText size={size} />
  );
}
export default function FileTree({
  analysis,
  selected,
  onSelect,
}: {
  analysis: ArchiveAnalysis;
  selected?: number;
  onSelect: (e: ArchiveEntry) => void;
}) {
  const [search, setSearch] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const root = useMemo(() => tree(analysis.entries), [analysis]);
  const suspicious = new Set(
    analysis.findings.filter((f) => f.severity !== 'info').map((f) => f.fileId),
  );
  const matches = analysis.entries.filter(
    (e) =>
      !e.directory &&
      (e.path.toLowerCase().includes(search.toLowerCase()) ||
        e.text?.toLowerCase().includes(search.toLowerCase())),
  );
  function render(node: Node, depth: number) {
    const directory = node.children.length > 0 || node.entry?.directory;
    const open = (depth === 0) !== closed.has(node.path);
    return (
      <div key={`${node.path}:${node.entry?.id ?? 'd'}`}>
        <button
          title={node.entry?.path ?? node.path}
          className={`tree-row ${node.entry?.id === selected ? 'selected' : ''}`}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => {
            if (directory)
              setClosed((current) => {
                const next = new Set(current);
                if (next.has(node.path)) next.delete(node.path);
                else next.add(node.path);
                return next;
              });
            else if (node.entry) onSelect(node.entry);
          }}
        >
          {directory ? (
            <>
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{' '}
              {open ? <FolderOpen size={15} /> : <Folder size={15} />}
            </>
          ) : (
            <>
              <span className="tree-spacer" />
              {node.entry && <FileIcon entry={node.entry} size={15} />}
            </>
          )}
          <span className="tree-name">{visibleName(node.name)}</span>
          {suspicious.has(node.entry?.id) && (
            <span className="file-warning" aria-label="Signal détecté" />
          )}
        </button>
        {directory && open && node.children.map((child) => render(child, depth + 1))}
      </div>
    );
  }
  return (
    <div className="file-tree">
      <div className="tree-heading">
        <span>EXPLORATEUR</span>
        <span>{analysis.entries.filter((e) => !e.directory).length}</span>
      </div>
      <label className="search-field">
        <Search size={15} />
        <input
          aria-label="Rechercher dans les noms et contenus lus"
          placeholder="Fichier ou contenu…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <kbd>⌕</kbd>
      </label>
      <div className="tree-scroll">
        {search ? (
          matches.length ? (
            matches.map((e) => (
              <button
                key={e.id}
                className={`search-result ${selected === e.id ? 'selected' : ''}`}
                onClick={() => onSelect(e)}
              >
                <FileIcon entry={e} />
                <span>
                  {visibleName(e.path)}
                  <small>
                    {e.path.toLowerCase().includes(search.toLowerCase())
                      ? 'Nom du fichier'
                      : 'Correspondance dans le contenu lu'}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p className="empty-note">
              Aucune correspondance dans les fichiers inventoriés et les contenus lus.
            </p>
          )
        ) : (
          root.children.map((n) => render(n, 0))
        )}
      </div>
      <div className="tree-bottom">Recherche limitée aux contenus lus.</div>
    </div>
  );
}
