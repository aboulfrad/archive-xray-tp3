import { Inflate } from 'fflate';
import { LIMITS, type ArchiveEntry, type FileKind } from './types';

export class ArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchiveError';
  }
}
const CP437 =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const utf8 = new TextDecoder('utf-8', { fatal: true });
function decodeName(bytes: Uint8Array, flags: number): string {
  try {
    return flags & 0x800
      ? utf8.decode(bytes)
      : Array.from(bytes, (b) => (b < 128 ? String.fromCharCode(b) : CP437[b - 128])).join('');
  } catch {
    throw new ArchiveError('Un nom de fichier possède un encodage UTF-8 invalide.');
  }
}
export function classify(path: string): FileKind {
  const name = path.split('/').at(-1)?.toLowerCase() ?? '';
  if (/\.(png|jpe?g|gif|webp|bmp|ico|svg)$/.test(name)) return 'image';
  if (/\.(zip|rar|7z|tar|gz|bz2|xz)$/.test(name)) return 'archive';
  if (/\.(exe|dll|so|dylib|bin|app|dmg|msi|com|class|jar|wasm|pyc|pdf|docx|xlsx|pptx)$/.test(name))
    return 'binary';
  if (
    /\.(json|ya?ml|toml|ini|conf|config|lock)$/.test(name) ||
    name.startsWith('.env') ||
    ['dockerfile', '.gitignore', '.npmrc'].includes(name)
  )
    return 'config';
  if (
    /\.(tsx?|jsx?|mjs|cjs|py|java|c|cpp|h|cs|go|rs|php|rb|sql|sh|ps1|html|css|scss|vue|svelte|feature)$/.test(
      name,
    )
  )
    return 'code';
  if (/\.(md|txt|rst|csv|log|xml)$/.test(name) || ['license', 'makefile', 'readme'].includes(name))
    return 'document';
  return 'other';
}
export function unsafePath(path: string): boolean {
  const normalized = path.replaceAll('\\', '/');
  return (
    Array.from(path).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
    normalized.startsWith('/') ||
    /^[a-z]:/i.test(normalized) ||
    normalized
      .replace(/\/$/, '')
      .split('/')
      .some(
        (segment) =>
          !segment ||
          segment === '..' ||
          segment === '.' ||
          segment.includes(':') ||
          /[. ]$/.test(segment) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment),
      )
  );
}
export function parseZip(buffer: Uint8Array): ArchiveEntry[] {
  if (buffer.length > LIMITS.archiveBytes)
    throw new ArchiveError('Archive trop volumineuse : la limite est de 64 Mo.');
  if (buffer.length < 22) throw new ArchiveError('Ce fichier n’est pas une archive ZIP complète.');
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let end = -1;
  for (let p = buffer.length - 22; p >= Math.max(0, buffer.length - 65557); p--) {
    if (
      view.getUint32(p, true) === 0x06054b50 &&
      p + 22 + view.getUint16(p + 20, true) === buffer.length
    ) {
      end = p;
      break;
    }
  }
  if (end < 0)
    throw new ArchiveError(
      'Répertoire ZIP introuvable : archive tronquée ou format non pris en charge.',
    );
  const count = view.getUint16(end + 10, true);
  const length = view.getUint32(end + 12, true);
  const start = view.getUint32(end + 16, true);
  if (count === 0xffff || length === 0xffffffff || start === 0xffffffff)
    throw new ArchiveError('Les archives ZIP64 ne sont pas prises en charge.');
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    view.getUint16(end + 8, true) !== count
  ) {
    throw new ArchiveError(
      'Les archives réparties sur plusieurs volumes ne sont pas prises en charge.',
    );
  }
  if (count > LIMITS.files)
    throw new ArchiveError('Trop de fichiers : la limite est de 2 500 entrées.');
  if (start + length !== end)
    throw new ArchiveError('Le répertoire ZIP est incohérent ou tronqué.');
  const entries: ArchiveEntry[] = [];
  let nameBytes = 0;
  const treeNodes = new Set<string>();
  const validateExtra = (position: number, length: number) => {
    const end = position + length;
    while (position < end) {
      if (position + 4 > end) throw new ArchiveError('Champ supplémentaire ZIP tronqué.');
      const id = view.getUint16(position, true);
      const size = view.getUint16(position + 2, true);
      if (id === 1) throw new ArchiveError('Les entrées ZIP64 ne sont pas prises en charge.');
      if (id === 0x7075)
        throw new ArchiveError(
          'Les champs Unicode remplaçant le nom ZIP ne sont pas pris en charge.',
        );
      position += 4 + size;
      if (position > end) throw new ArchiveError('Champ supplémentaire ZIP invalide.');
    }
  };
  const intervals: [number, number][] = [];
  let p = start,
    total = 0;
  for (let id = 0; id < count; id++) {
    if (p + 46 > end || view.getUint32(p, true) !== 0x02014b50)
      throw new ArchiveError('Entrée ZIP centrale invalide.');
    const flags = view.getUint16(p + 8, true),
      method = view.getUint16(p + 10, true);
    const crc = view.getUint32(p + 16, true),
      compressedSize = view.getUint32(p + 20, true),
      size = view.getUint32(p + 24, true);
    const nameLength = view.getUint16(p + 28, true),
      extra = view.getUint16(p + 30, true),
      comment = view.getUint16(p + 32, true);
    const attrs = view.getUint32(p + 38, true),
      localOffset = view.getUint32(p + 42, true);
    const next = p + 46 + nameLength + extra + comment;
    if (!nameLength || next > end || view.getUint16(p + 34, true))
      throw new ArchiveError('Métadonnées ZIP invalides.');
    if ([compressedSize, size, localOffset].includes(0xffffffff))
      throw new ArchiveError('Les entrées ZIP64 ne sont pas prises en charge.');
    validateExtra(p + 46 + nameLength, extra);
    if (localOffset + 30 > start || view.getUint32(localOffset, true) !== 0x04034b50)
      throw new ArchiveError('En-tête local ZIP invalide.');
    const localNameLength = view.getUint16(localOffset + 26, true),
      localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (
      dataOffset + compressedSize > start ||
      localNameLength !== nameLength ||
      view.getUint16(localOffset + 6, true) !== flags ||
      view.getUint16(localOffset + 8, true) !== method
    ) {
      throw new ArchiveError('Les en-têtes locaux et centraux ne correspondent pas.');
    }
    validateExtra(localOffset + 30 + localNameLength, localExtraLength);
    for (let j = 0; j < nameLength; j++) {
      if (buffer[p + 46 + j] !== buffer[localOffset + 30 + j])
        throw new ArchiveError('Noms locaux et centraux contradictoires.');
    }
    if (
      !(flags & 8) &&
      (view.getUint32(localOffset + 14, true) !== crc ||
        view.getUint32(localOffset + 18, true) !== compressedSize ||
        view.getUint32(localOffset + 22, true) !== size)
    ) {
      throw new ArchiveError('Les tailles ou sommes de contrôle déclarées sont contradictoires.');
    }
    intervals.push([localOffset, dataOffset + compressedSize]);
    const path = decodeName(buffer.subarray(p + 46, p + 46 + nameLength), flags);
    if (nameLength > 4096 || path.replaceAll('\\', '/').split('/').length > 65)
      throw new ArchiveError('Nom de fichier trop long ou arborescence supérieure à 64 niveaux.');
    nameBytes += nameLength;
    if (nameBytes > LIMITS.nameBytes)
      throw new ArchiveError('Volume cumulé des noms supérieur à 1 Mo.');
    const segments = path.replaceAll('\\', '/').split('/');
    let prefix = '';
    for (const segment of segments) {
      prefix += `${segment}/`;
      treeNodes.add(prefix);
      if (treeNodes.size > LIMITS.treeNodes)
        throw new ArchiveError('Arborescence supérieure à 10 000 éléments.');
    }
    const mode = (attrs >>> 16) & 0xffff;
    const symlink = (mode & 0xf000) === 0xa000;
    const directory = path.endsWith('/') || (attrs & 0x10) !== 0 || (mode & 0xf000) === 0x4000;
    const executable =
      !directory && ((mode & 0o111) !== 0 || /\.(exe|msi|com|bat|cmd|ps1|sh|jar|app)$/i.test(path));
    entries.push({
      id,
      path,
      flags,
      method,
      crc,
      compressedSize,
      size,
      localOffset,
      directory,
      symlink,
      executable,
      kind: classify(path),
      inspected: false,
    });
    total += size;
    if (total > LIMITS.declaredTotal)
      throw new ArchiveError('Volume décompressé annoncé trop élevé : la limite est de 256 Mo.');
    p = next;
  }
  if (p !== end) throw new ArchiveError('Le nombre d’entrées ne correspond pas au répertoire ZIP.');
  intervals.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i]![0] < intervals[i - 1]![1])
      throw new ArchiveError('Des entrées ZIP se chevauchent.');
  }
  return entries;
}
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function readEntry(
  buffer: Uint8Array,
  entry: ArchiveEntry,
  maximum = LIMITS.previewBytes,
): Uint8Array {
  if (entry.flags & 1) throw new ArchiveError('Fichier chiffré : contenu non analysé.');
  if (entry.symlink || unsafePath(entry.path))
    throw new ArchiveError('Fichier exclu de la lecture pour son chemin ou son type.');
  if (entry.size > maximum || entry.compressedSize > LIMITS.archiveBytes)
    throw new ArchiveError('Fichier au-delà de la limite de lecture.');
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const offset =
    entry.localOffset +
    30 +
    view.getUint16(entry.localOffset + 26, true) +
    view.getUint16(entry.localOffset + 28, true);
  const source = buffer.subarray(offset, offset + entry.compressedSize);
  let result: Uint8Array;
  if (entry.method === 0) {
    if (source.length > maximum) throw new ArchiveError('Données stockées au-delà de la limite.');
    result = source.slice();
  } else if (entry.method === 8) {
    const chunks: Uint8Array[] = [];
    let size = 0;
    const stream = new Inflate((chunk) => {
      size += chunk.length;
      if (size > maximum || size > entry.size)
        throw new ArchiveError('Décompression interrompue : taille réelle excessive.');
      chunks.push(chunk);
    });
    if (!source.length) stream.push(source, true);
    for (let p = 0; p < source.length; p += 512)
      stream.push(source.subarray(p, p + 512), p + 512 >= source.length);
    result = new Uint8Array(size);
    let position = 0;
    for (const chunk of chunks) {
      result.set(chunk, position);
      position += chunk.length;
    }
  } else {
    throw new ArchiveError('Méthode de compression non prise en charge.');
  }
  if (result.length !== entry.size || crc32(result) !== entry.crc)
    throw new ArchiveError('Contenu corrompu : taille ou CRC incorrect.');
  return result;
}

export function visibleName(name: string): string {
  return name.replace(
    /[\u202a-\u202e\u2066-\u2069\u200b-\u200f\ufeff]/gu,
    (char) => `[U+${char.charCodeAt(0).toString(16).toUpperCase()}]`,
  );
}
