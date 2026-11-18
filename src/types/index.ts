export type ToolId = 'merge' | 'split' | 'organize' | 'rotate' | 'images-pdf' | 'pdf-images' | 'compress'
  | 'delete' | 'extract' | 'scan' | 'repair' | 'ocr' | 'word-pdf' | 'ppt-pdf' | 'excel-pdf' | 'html-pdf'
  | 'pdf-word' | 'pdf-ppt' | 'pdf-excel' | 'pdf-a' | 'numbers' | 'watermark' | 'crop' | 'edit' | 'forms'
  | 'unlock' | 'protect' | 'sign' | 'redact' | 'compare';
export type Category = 'Tous les outils' | 'Organiser' | 'Optimiser' | 'Vers PDF' | 'Depuis PDF' | 'Modifier' | 'Sécurité';
export type FileSource = { id: string; name: string; bytes: Uint8Array; kind: 'pdf' | 'png' | 'jpg'; pageCount: number };
export type PageRef = { id: string; sourceId: string; index: number; rotation: number };
export type ResultFile = { name: string; bytes: Uint8Array; mime: string };
export type PdfJob = {
  tool: ToolId;
  sources: FileSource[];
  pages: PageRef[];
  selection: number[];
  groups: number[][];
  angle: number;
  pageSize: 'a4' | 'letter' | 'fit';
  landscape: boolean;
  margin: number;
};
export type JobResponse = { type: 'progress'; value: number } | { type: 'done'; results: ResultFile[] } | { type: 'error'; message: string };
