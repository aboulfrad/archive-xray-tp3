import { zipSync } from 'fflate';
import { LIMITS, type ArchiveEntry } from './types';
import { ArchiveError, readEntry, unsafePath } from './zip';

export function exportFiltered(
  buffer: Uint8Array,
  entries: ArchiveEntry[],
  selected: Set<number>,
): Uint8Array {
  const files: Record<string, Uint8Array> = Object.create(null) as Record<string, Uint8Array>;
  const names = new Set<string>();
  let total = 0,
    count = 0;
  for (const e of entries) {
    if (e.directory || !selected.has(e.id)) continue;
    if (
      unsafePath(e.path) ||
      e.symlink ||
      e.flags & 1 ||
      ![0, 8].includes(e.method) ||
      (e.size > 65536 && e.size / Math.max(1, e.compressedSize) > LIMITS.ratio)
    )
      throw new ArchiveError(`Export refusé pour une entrée non contrôlable : ${e.path}`);
    const name = e.path.replaceAll('\\', '/');
    const canonical = name.normalize('NFC').toLowerCase();
    if (names.has(canonical))
      throw new ArchiveError('Deux fichiers sélectionnés ont des chemins en collision.');
    names.add(canonical);
    total += e.size;
    if (total > LIMITS.exportBytes)
      throw new ArchiveError('La sélection dépasse la limite d’export de 32 Mo.');
    files[name] = readEntry(buffer, e, Math.min(LIMITS.exportBytes, e.size));
    count++;
  }
  if (!count) throw new ArchiveError('Sélectionnez au moins un fichier à exporter.');
  return zipSync(files, { level: 0 });
}
