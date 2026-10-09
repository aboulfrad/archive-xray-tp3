import { inspectArchive } from './core/inspect';
import { exportFiltered } from './core/export';
import type { ArchiveEntry } from './core/types';

self.onmessage = async (
  event: MessageEvent<{
    type: 'inspect' | 'export';
    buffer: ArrayBuffer;
    name?: string;
    entries?: ArchiveEntry[];
    selected?: number[];
  }>,
) => {
  try {
    if (event.data.type === 'inspect') {
      const analysis = await inspectArchive(
        new Uint8Array(event.data.buffer),
        event.data.name ?? 'archive.zip',
        (done, total) => {
          self.postMessage({ type: 'progress', done, total });
        },
      );
      self.postMessage({ type: 'result', analysis });
    } else {
      const bytes = exportFiltered(
        new Uint8Array(event.data.buffer),
        event.data.entries ?? [],
        new Set(event.data.selected),
      );
      self.postMessage({ type: 'export', bytes }, { transfer: [bytes.buffer] });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Analyse interrompue.',
    });
  }
};
