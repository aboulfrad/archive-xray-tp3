import { useEffect, useState } from 'react';
import { Code2, Eye, FileQuestion, Image as ImageIcon, LockKeyhole } from 'lucide-react';
import { redactText } from '../core/inspect';
import type { ArchiveEntry } from '../core/types';

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  let code = false;
  return (
    <div className="markdown-preview">
      {lines.slice(0, 2000).map((line, i) => {
        if (line.startsWith('```')) {
          code = !code;
          return (
            <div key={i} className="fence-label">
              {line.slice(3) || 'fin du bloc'}
            </div>
          );
        }
        if (code)
          return (
            <pre key={i} className="markdown-code">
              {line || ' '}
            </pre>
          );
        if (/^### /.test(line)) return <h3 key={i}>{line.slice(4)}</h3>;
        if (/^## /.test(line)) return <h2 key={i}>{line.slice(3)}</h2>;
        if (/^# /.test(line)) return <h1 key={i}>{line.slice(2)}</h1>;
        if (/^[-*] /.test(line))
          return (
            <p key={i} className="markdown-bullet">
              <span>•</span>
              {line.slice(2)}
            </p>
          );
        if (/^> /.test(line)) return <blockquote key={i}>{line.slice(2)}</blockquote>;
        return <p key={i}>{line || '\u00a0'}</p>;
      })}
    </div>
  );
}
export default function Preview({ entry, focusLine }: { entry: ArchiveEntry; focusLine?: number }) {
  const [rendered, setRendered] = useState(true);
  const [masked, setMasked] = useState(true);
  const [imageUrl, setImageUrl] = useState<string>();
  useEffect(() => {
    setMasked(true);
    setRendered(true);
    if (!entry.bytes) {
      setImageUrl(undefined);
      return;
    }
    const mime = /\.png$/i.test(entry.path)
      ? 'image/png'
      : /\.jpe?g$/i.test(entry.path)
        ? 'image/jpeg'
        : /\.gif$/i.test(entry.path)
          ? 'image/gif'
          : 'image/webp';
    const url = URL.createObjectURL(new Blob([new Uint8Array(entry.bytes)], { type: mime }));
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [entry]);
  useEffect(() => {
    if (focusLine)
      document
        .getElementById(`code-line-${focusLine}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusLine, entry]);
  const text = entry.text === undefined ? undefined : masked ? redactText(entry.text) : entry.text;
  const markdown = /\.md$/i.test(entry.path);
  const lines = text?.split('\n') ?? [];
  const start = Math.max(0, (focusLine ?? 1) - 1000);
  const visible = lines.slice(start, start + 2000);
  if (text !== undefined)
    return (
      <>
        <div className="preview-toolbar">
          <span>{markdown ? 'Markdown' : entry.path.split('.').at(-1)?.toUpperCase()} · UTF-8</span>
          <div className="button-group">
            {markdown && (
              <button className="quiet-button" onClick={() => setRendered(!rendered)}>
                {rendered ? <Code2 size={15} /> : <Eye size={15} />}{' '}
                {rendered ? 'Source' : 'Lecture'}
              </button>
            )}
            <button
              className={`quiet-button ${masked ? 'lime-text' : ''}`}
              onClick={() => setMasked(!masked)}
            >
              <LockKeyhole size={14} />
              {masked ? 'Secrets masqués' : 'Valeurs visibles'}
            </button>
          </div>
        </div>
        {lines.length > 2000 && (
          <p className="preview-limit">
            Aperçu limité à 2 000 lignes. Le rapport conserve les constats du contenu lu.
          </p>
        )}
        {markdown && rendered && !focusLine ? (
          <Markdown text={text} />
        ) : (
          <div className="code-preview" role="region" aria-label="Contenu du fichier">
            {visible.map((line, i) => (
              <div
                id={`code-line-${start + i + 1}`}
                key={i}
                className={`code-line ${start + i + 1 === focusLine ? 'focused-line' : ''}`}
              >
                <span className="line-number">{start + i + 1}</span>
                <code className={/^\s*(\/\/|#|\*)/.test(line) ? 'comment-line' : ''}>
                  {line || ' '}
                </code>
              </div>
            ))}
          </div>
        )}
      </>
    );
  if (imageUrl)
    return (
      <div className="image-preview">
        <ImageIcon size={18} />
        <img src={imageUrl} alt={`Aperçu de ${entry.path}`} />
      </div>
    );
  return (
    <div className="empty-reader">
      <FileQuestion size={38} />
      <h3>Aucun aperçu disponible</h3>
      <p>{entry.reason ?? 'Ce format est inventorié mais ne possède pas de lecteur intégré.'}</p>
      <span className="tag">Aucun fichier n’est exécuté</span>
    </div>
  );
}
