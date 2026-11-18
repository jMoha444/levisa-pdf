import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { FileWarning } from 'lucide-react';
import { renderPage } from '../lib/pdf-render';

export function Thumbnail({ pdf, index, rotation = 0 }: { pdf?: PDFDocumentProxy; index: number; rotation?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const abort = new AbortController();
    let alive = true;
    let started = false;
    const draw = async () => {
      if (started) return;
      started = true;
      try {
        const page = await pdf.getPage(index + 1);
        const view = page.getViewport({ scale: 1, rotation: page.rotate + rotation });
        if (alive) await renderPage(pdf, index, canvas, Math.min(320 / view.width, 400 / view.height), rotation, abort.signal);
      } catch { if (alive && !abort.signal.aborted) setError(true); }
    };
    const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) { void draw(); observer.disconnect(); } }, { rootMargin: '200px' });
    observer.observe(canvas);
    return () => { alive = false; observer.disconnect(); abort.abort(); canvas.width = 0; canvas.height = 0; };
  }, [pdf, index, rotation]);
  return error ? <div className="preview-error"><FileWarning size={26} /><span>Aperçu indisponible</span></div> : <canvas ref={canvasRef} className="thumbnail-canvas" aria-label={`Aperçu de la page ${index + 1}`} />;
}
