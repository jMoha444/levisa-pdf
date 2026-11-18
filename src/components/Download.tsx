import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import type { ResultFile } from '../types';
import { formatBytes } from '../lib/limits';

export function DownloadLink({ file, primary = false, label }: { file: ResultFile; primary?: boolean; label?: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const value = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.mime }));
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  return <a className={primary ? 'button primary download-main' : 'download-link'} href={url || undefined} download={file.name}><Download size={primary ? 19 : 16} /><span>{label || file.name}</span><small>{formatBytes(file.bytes.length)}</small></a>;
}
