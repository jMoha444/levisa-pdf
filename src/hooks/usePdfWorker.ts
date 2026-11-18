import { useCallback, useEffect, useRef } from 'react';
import type { PdfJob, JobResponse, ResultFile } from '../types';

export function usePdfWorker() {
  const workerRef = useRef<Worker | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const cancel = useCallback(() => { cancelRef.current?.(); workerRef.current?.terminate(); workerRef.current = null; }, []);
  useEffect(() => cancel, [cancel]);
  const run = useCallback((job: PdfJob, progress: (value: number) => void): Promise<ResultFile[]> => {
    cancel();
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../workers/pdf.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      const cleanup = () => { clearTimeout(timeout); worker.terminate(); workerRef.current = null; cancelRef.current = null; };
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Le traitement est trop long. Essayez moins de pages ou un fichier plus petit.')); }, 90_000);
      cancelRef.current = () => { cleanup(); reject(new Error('Opération annulée.')); };
      worker.onmessage = (event: MessageEvent<JobResponse>) => {
        const data = event.data;
        if (data.type === 'progress') progress(data.value);
        else if (data.type === 'error') { cleanup(); reject(new Error(data.message)); }
        else { cleanup(); resolve(data.results); }
      };
      worker.onerror = () => { cleanup(); reject(new Error('Le moteur PDF a rencontré une erreur. Réessayez avec un document plus petit.')); };
      worker.postMessage(job);
    });
  }, [cancel]);
  return { run, cancel };
}
