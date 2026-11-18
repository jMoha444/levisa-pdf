import { zipSync } from 'fflate';
import type { ResultFile } from '../types';
self.onmessage = (event: MessageEvent<ResultFile[]>) => {
  const files = Object.fromEntries(event.data.map(file => [file.name, file.bytes]));
  const bytes = zipSync(files, { level: 0 });
  self.postMessage(bytes, { transfer: [bytes.buffer] });
};
