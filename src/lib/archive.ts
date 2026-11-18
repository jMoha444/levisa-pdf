import type { ResultFile } from '../types';
export function createArchive(files: ResultFile[], signal: AbortSignal): Promise<ResultFile> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/archive.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { clearTimeout(timeout); signal.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { cleanup(); reject(new Error('Opération annulée.')); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Création de l’archive trop longue. Essayez moins de pages.')); }, 60_000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    worker.onmessage = (event: MessageEvent<Uint8Array>) => { cleanup(); resolve({ name: 'levisa-resultats.zip', bytes: event.data, mime: 'application/zip' }); };
    worker.onerror = () => { cleanup(); reject(new Error('Impossible de préparer l’archive.')); };
    worker.postMessage(files);
  });
}
