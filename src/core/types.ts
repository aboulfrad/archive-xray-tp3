export type Severity = 'critical' | 'warning' | 'info';
export type FileKind = 'code' | 'document' | 'image' | 'config' | 'archive' | 'binary' | 'other';
export interface Finding {
  id: string;
  rule: string;
  severity: Severity;
  title: string;
  detail: string;
  fileId?: number;
  path?: string;
  line?: number;
  evidence?: string;
}
export interface ArchiveEntry {
  id: number;
  path: string;
  compressedSize: number;
  size: number;
  crc: number;
  method: number;
  flags: number;
  localOffset: number;
  directory: boolean;
  symlink: boolean;
  executable: boolean;
  kind: FileKind;
  text?: string;
  bytes?: Uint8Array;
  inspected: boolean;
  exportExcluded?: boolean;
  reason?: string;
}
export interface ArchiveAnalysis {
  name: string;
  byteLength: number;
  analyzedAt: string;
  entries: ArchiveEntry[];
  findings: Finding[];
  totalSize: number;
  contentBytes: number;
  inspectedCount: number;
}
export type Profile = 'project' | 'web' | 'custom' | 'tp1' | 'tp2' | 'tp3';
export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  status: 'found' | 'missing' | 'review';
  files: ArchiveEntry[];
}
export interface Annotation {
  fileId: number;
  text: string;
  line?: number;
}
export interface ComparisonEntry {
  path: string;
  state: 'added' | 'removed' | 'changed' | 'same';
  before?: ArchiveEntry;
  after?: ArchiveEntry;
}
export const LIMITS = Object.freeze({
  archiveBytes: 64 * 1024 * 1024,
  files: 2500,
  findings: 500,
  secretsPerFile: 25,
  nameBytes: 1024 * 1024,
  treeNodes: 10000,
  declaredTotal: 256 * 1024 * 1024,
  previewBytes: 1024 * 1024,
  contentBudget: 12 * 1024 * 1024,
  ratio: 200,
  exportBytes: 32 * 1024 * 1024,
  imageSide: 8192,
  imagePixels: 4_000_000,
});
