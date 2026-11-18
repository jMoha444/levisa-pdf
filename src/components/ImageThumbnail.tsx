import { useEffect, useState } from 'react';
import type { FileSource } from '../types';
export function ImageThumbnail({ source }: { source: FileSource }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const value = URL.createObjectURL(new Blob([source.bytes as BlobPart], { type: source.kind === 'png' ? 'image/png' : 'image/jpeg' }));
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [source]);
  return url ? <img src={url} alt={`Aperçu de ${source.name}`} /> : null;
}
