import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { MAX_EXPORT_PIXELS, MAX_PAGES } from './limits';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function openPdf(bytes: Uint8Array, signal?: AbortSignal): Promise<PDFDocumentProxy> {
  const task = getDocument({
    data: bytes.slice(), enableXfa: false, stopAtErrors: true, maxImageSize: 40_000_000, canvasMaxAreaInBytes: 48_000_000,
    cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`, cMapPacked: true, standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
    wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`, iccUrl: `${import.meta.env.BASE_URL}pdfjs/iccs/`, useWorkerFetch: true,
  });
  const abort = () => { void task.destroy(); };
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 45_000);
  try {
    if (signal?.aborted) { await task.destroy(); throw new Error('Opération annulée.'); }
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES) { await pdf.loadingTask.destroy(); throw new Error('Ce PDF dépasse la limite de 150 pages.'); }
    return pdf;
  } catch (error) {
    // Failed and password-protected loads must also terminate their parser worker.
    await task.destroy().catch(() => {});
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

export async function renderPage(pdf: PDFDocumentProxy, index: number, canvas: HTMLCanvasElement, scale = 1, rotation?: number, signal?: AbortSignal): Promise<void> {
  const page = await pdf.getPage(index + 1);
  if (signal?.aborted) throw new Error('Opération annulée.');
  const viewport = page.getViewport({ scale, rotation: rotation === undefined ? page.rotate : page.rotate + rotation });
  if (!Number.isFinite(viewport.width * viewport.height) || viewport.width * viewport.height > MAX_EXPORT_PIXELS) throw new Error('Cette page est trop grande. Choisissez une résolution inférieure.');
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const task = page.render({ canvas, viewport, background: 'white' });
  const abort = () => task.cancel();
  signal?.addEventListener('abort', abort, { once: true });
  try { await task.promise; } finally { signal?.removeEventListener('abort', abort); page.cleanup(); }
}

export async function canvasBytes(canvas: HTMLCanvasElement, mime: 'image/png' | 'image/jpeg'): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Impossible de créer cette image.')), mime, 0.9));
  return new Uint8Array(await blob.arrayBuffer());
}
