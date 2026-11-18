export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_PAGES = 150;
export const MAX_FILES = 40;
export const MAX_EXPORT_PIXELS = 12_000_000;
export const MAX_OUTPUT_BYTES = 100 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Ko`;
  return `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

export function sniffFile(bytes: Uint8Array): 'pdf' | 'png' | 'jpg' | null {
  if (bytes.length < 8) return null;
  // Do not trust a file extension or the browser's MIME type.
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  if (head.includes('%PDF-')) return 'pdf';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  return null;
}

export function validateFiles(files: Pick<File, 'size'>[], existingBytes = 0, existingCount = 0): void {
  if (!files.length) throw new Error('Sélectionnez au moins un fichier.');
  if (files.length + existingCount > MAX_FILES) throw new Error(`Ajoutez au maximum ${MAX_FILES} fichiers à la fois.`);
  if (files.some(f => f.size === 0)) throw new Error('Un fichier est vide. Choisissez un autre document.');
  if (files.some(f => f.size > MAX_FILE_BYTES)) throw new Error('Un fichier dépasse 25 Mo. Utilisez un document plus léger.');
  if (files.reduce((sum, f) => sum + f.size, existingBytes) > MAX_TOTAL_BYTES) throw new Error('La limite de 50 Mo par opération est dépassée. Traitez moins de fichiers à la fois.');
}

/** Inspect image headers before allocating a decoded bitmap. */
export function validateImageDimensions(bytes: Uint8Array, kind: 'png' | 'jpg'): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  if (kind === 'png') {
    if (bytes.length < 24) throw new Error('Cette image PNG est incomplète.');
    width = view.getUint32(16); height = view.getUint32(20);
  } else {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) {
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break;
      }
      offset += length;
    }
  }
  if (!width || !height) throw new Error('Les dimensions de cette image ne sont pas lisibles.');
  if (width * height > 40_000_000 || width > 16000 || height > 16000) throw new Error('Une image est trop grande (40 mégapixels et 16 000 pixels par côté maximum).');
}

export function userError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (/password|encrypt/i.test(name + message)) return 'Ce PDF est protégé par un mot de passe. Les PDF chiffrés ne sont pas pris en charge dans cette version.';
  if (/invalid|parse|xref|malformed|header|corrupt/i.test(name + message)) return 'Ce fichier PDF est endommagé ou non pris en charge. Essayez un autre document.';
  return message.length < 250 ? message : 'Le traitement a échoué. Essayez un fichier plus petit ou un autre PDF.';
}
