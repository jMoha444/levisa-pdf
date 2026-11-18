import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { processPdf } from '../src/tools/pdf';
import { parseGroups, parsePages } from '../src/lib/ranges';
import { MAX_FILE_BYTES, MAX_TOTAL_BYTES, sniffFile, validateFiles, validateImageDimensions } from '../src/lib/limits';
import type { FileSource, PdfJob } from '../src/types';

async function source(id = 'a', sizes = [200, 300, 400]): Promise<FileSource> {
  const doc = await PDFDocument.create();
  sizes.forEach((width, index) => { const page = doc.addPage([width, 500]); page.drawText(`TEST ${id} page ${index + 1}`); });
  return { id, name: `${id}.pdf`, bytes: await doc.save({ useObjectStreams: false }), kind: 'pdf', pageCount: sizes.length };
}
function job(sources: FileSource[], tool: PdfJob['tool']): PdfJob {
  return { sources, tool, pages: [], selection: [], groups: [], angle: 90, pageSize: 'a4', landscape: false, margin: 20 };
}
async function widths(bytes: Uint8Array) { return (await PDFDocument.load(bytes)).getPages().map(page => page.getWidth()); }

describe('page selection, inclusive one-based syntax', () => {
  it('accepts intervals, order and deduplication', () => expect(parsePages('4, 1-3, 2', 5)).toEqual([3, 0, 1, 2]));
  it('selects all pages for an empty range', () => expect(parsePages('', 3)).toEqual([0, 1, 2]));
  it.each(['0', '1-7', '3-1', '2,,3', '1e2', '-1', '1;2', '9999999999'])('rejects invalid range %s', range => expect(() => parsePages(range, 5)).toThrow());
  it('handles independent groups', () => expect(parseGroups('1-2 ; 3,5', 5)).toEqual([[0, 1], [2, 4]]));
  it.each(['', '1;', ';2', '1;;2'])('rejects empty groups %s', range => expect(() => parseGroups(range, 5)).toThrow());
});
describe('file validation', () => {
  it('detects actual PDF bytes', async () => expect(sniffFile((await source()).bytes)).toBe('pdf'));
  it('rejects misleading extensions and short files', () => { expect(sniffFile(new TextEncoder().encode('<html>fake pdf</html>'))).toBeNull(); expect(sniffFile(new Uint8Array(3))).toBeNull(); });
  it('enforces empty, size, aggregate and file count limits', () => {
    expect(() => validateFiles([{ size: 0 }])).toThrow();
    expect(() => validateFiles([{ size: MAX_FILE_BYTES + 1 }])).toThrow();
    expect(() => validateFiles([{ size: 1 }], MAX_TOTAL_BYTES)).toThrow();
    expect(() => validateFiles([{ size: 1 }], 0, 40)).toThrow();
    expect(() => validateFiles([{ size: 100 }])).not.toThrow();
  });
  it('rejects an image allocation bomb before decoding', () => {
    const bytes = new Uint8Array(24); const view = new DataView(bytes.buffer);
    view.setUint32(16, 100_000); view.setUint32(20, 100_000);
    expect(() => validateImageDimensions(bytes, 'png')).toThrow(/trop grande/);
    expect(() => validateImageDimensions(new Uint8Array(24), 'jpg')).toThrow();
  });
});
describe('real PDF transformations', () => {
  it('merges files in the supplied order with intact page dimensions', async () => {
    const output = await processPdf(job([await source('b', [600]), await source('a')], 'merge'));
    expect(await widths(output[0].bytes)).toEqual([600, 200, 300, 400]);
  });
  it('requires two documents to merge', async () => await expect(processPdf(job([await source()], 'merge'))).rejects.toThrow());
  it('splits into separate groups with correct page order', async () => {
    const input = job([await source()], 'split'); input.groups = [[2, 0], [1]];
    const output = await processPdf(input);
    expect(output).toHaveLength(2);
    expect(await widths(output[0].bytes)).toEqual([400, 200]);
    expect(await widths(output[1].bytes)).toEqual([300]);
  });
  it('organizes across documents, deletes and rotates', async () => {
    const input = job([await source('a'), await source('b', [600])], 'organize');
    input.pages = [{ id: '1', sourceId: 'b', index: 0, rotation: 90 }, { id: '2', sourceId: 'a', index: 2, rotation: 180 }];
    const output = await processPdf(input);
    const doc = await PDFDocument.load(output[0].bytes);
    expect(doc.getPages().map(p => [p.getWidth(), p.getRotation().angle])).toEqual([[600, 90], [400, 180]]);
  });
  it('does not export a zero-page document', async () => await expect(processPdf(job([await source()], 'organize'))).rejects.toThrow());
  it('rotates only chosen pages', async () => {
    const input = job([await source()], 'rotate'); input.selection = [1]; input.angle = 270;
    const output = await processPdf(input);
    expect((await PDFDocument.load(output[0].bytes)).getPages().map(p => p.getRotation().angle)).toEqual([0, 270, 0]);
  });
  it('creates an A4 PDF from a PNG without remote resources', async () => {
    const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1sAAAAASUVORK5CYII=', 'base64'));
    const output = await processPdf(job([{ id: 'image', name: 'test.png', kind: 'png', bytes: png, pageCount: 1 }], 'images-pdf'));
    const doc = await PDFDocument.load(output[0].bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 });
  });
  it('optimizes structure without increasing size', async () => {
    const src = await source();
    const output = await processPdf(job([src], 'compress'));
    expect(output[0].bytes.length).toBeLessThanOrEqual(src.bytes.length);
    expect(await widths(output[0].bytes)).toEqual([200, 300, 400]);
  });
  it('rejects malformed documents', async () => {
    const src = await source(); src.bytes = new TextEncoder().encode('%PDF-1.7 broken content');
    await expect(processPdf(job([src], 'compress'))).rejects.toThrow();
  });
  it('does not bypass encryption', async () => {
    const doc = await PDFDocument.create(); doc.addPage();
    doc.context.trailerInfo.Encrypt = doc.context.register(doc.context.obj({ Filter: PDFName.of('Standard') }));
    const bytes = await doc.save();
    await expect(processPdf(job([{ id: 'locked', name: 'locked.pdf', kind: 'pdf', bytes, pageCount: 1 }], 'compress'))).rejects.toThrow(/encrypted/i);
  });
});
