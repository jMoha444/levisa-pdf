import { degrees, PDFDocument } from 'pdf-lib';
import type { PdfJob, ResultFile } from '../types';
import { MAX_OUTPUT_BYTES, MAX_PAGES } from '../lib/limits';

const mime = 'application/pdf';
const fresh = async () => { const pdf = await PDFDocument.create(); pdf.setProducer('LEVISA PDF'); pdf.setCreator('LEVISA PDF'); return pdf; };
const result = async (doc: PDFDocument, name: string): Promise<ResultFile> => {
  const bytes = await doc.save({ useObjectStreams: true });
  if (bytes.length > MAX_OUTPUT_BYTES) throw new Error('Le résultat dépasse la limite de 100 Mo. Réduisez le nombre de pages.');
  return { name, bytes, mime };
};

export async function processPdf(job: PdfJob, progress: (value: number) => void = () => {}): Promise<ResultFile[]> {
  if (!job.sources.length) throw new Error('Ajoutez un document pour commencer.');
  const docs = new Map<string, PDFDocument>();
  for (let i = 0; i < job.sources.length; i++) {
    const source = job.sources[i];
    if (source.kind === 'pdf') docs.set(source.id, await PDFDocument.load(source.bytes, { updateMetadata: false, throwOnInvalidObject: true }));
    progress(5 + Math.round((i + 1) / job.sources.length * 15));
  }
  if (job.tool === 'images-pdf') {
    const out = await fresh();
    for (let i = 0; i < job.sources.length; i++) {
      const source = job.sources[i];
      const image = source.kind === 'png' ? await out.embedPng(source.bytes) : await out.embedJpg(source.bytes);
      if (image.width * image.height > 40_000_000) throw new Error('Une image est trop grande (40 mégapixels maximum).');
      let width = job.pageSize === 'letter' ? 612 : 595.28;
      let height = job.pageSize === 'letter' ? 792 : 841.89;
      if (job.pageSize === 'fit') { width = image.width * 0.75 + job.margin * 2; height = image.height * 0.75 + job.margin * 2; }
      else if (job.landscape) [width, height] = [height, width];
      const factor = Math.min((width - job.margin * 2) / image.width, (height - job.margin * 2) / image.height);
      const page = out.addPage([width, height]);
      page.drawImage(image, { x: (width - image.width * factor) / 2, y: (height - image.height * factor) / 2, width: image.width * factor, height: image.height * factor });
      progress(20 + Math.round((i + 1) / job.sources.length * 70));
    }
    return [await result(out, 'levisa-images.pdf')];
  }
  const first = docs.get(job.sources[0].id)!;
  if (job.tool === 'compress') {
    // Lossless structural rewrite. Never rasterize text, or promise size reduction.
    const optimized = await first.save({ useObjectStreams: true });
    progress(95);
    const smaller = optimized.length < job.sources[0].bytes.length;
    return [{ name: smaller ? 'levisa-optimise.pdf' : 'levisa-original.pdf', bytes: smaller ? optimized : job.sources[0].bytes, mime }];
  }
  if (job.tool === 'split') {
    const results: ResultFile[] = [];
    let totalBytes = 0;
    for (let i = 0; i < job.groups.length; i++) {
      const out = await fresh();
      for (const page of await out.copyPages(first, job.groups[i])) out.addPage(page);
      const file = await result(out, job.groups.length === 1 ? 'levisa-extrait.pdf' : `levisa-extrait-${String(i + 1).padStart(2, '0')}.pdf`);
      totalBytes += file.bytes.length;
      if (totalBytes > MAX_OUTPUT_BYTES) throw new Error('Les résultats dépassent 100 Mo. Sélectionnez moins de groupes.');
      results.push(file);
      progress(20 + Math.round((i + 1) / job.groups.length * 70));
    }
    return results;
  }
  if (job.tool === 'rotate') {
    for (const index of job.selection) {
      const page = first.getPage(index);
      page.setRotation(degrees((page.getRotation().angle + job.angle) % 360));
    }
    progress(90);
    return [await result(first, 'levisa-rotation.pdf')];
  }
  const out = await fresh();
  if (job.tool === 'merge') {
    if (job.sources.length < 2) throw new Error('Ajoutez au moins deux PDF à fusionner.');
    for (let i = 0; i < job.sources.length; i++) {
      const doc = docs.get(job.sources[i].id)!;
      for (const page of await out.copyPages(doc, doc.getPageIndices())) out.addPage(page);
      progress(20 + Math.round((i + 1) / job.sources.length * 70));
    }
  } else if (job.tool === 'organize') {
    if (!job.pages.length || job.pages.length > MAX_PAGES) throw new Error('Conservez au moins une page (150 pages maximum).');
    for (let i = 0; i < job.pages.length; i++) {
      const ref = job.pages[i];
      const [page] = await out.copyPages(docs.get(ref.sourceId)!, [ref.index]);
      page.setRotation(degrees((page.getRotation().angle + ref.rotation) % 360));
      out.addPage(page);
      progress(20 + Math.round((i + 1) / job.pages.length * 70));
    }
  } else { throw new Error('Outil non pris en charge.'); }
  if (out.getPageCount() > MAX_PAGES) throw new Error('Limite de 150 pages par opération.');
  return [await result(out, job.tool === 'merge' ? 'levisa-fusion.pdf' : 'levisa-organise.pdf')];
}
