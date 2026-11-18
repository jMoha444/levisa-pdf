import { processPdf } from '../tools/pdf';
import { userError } from '../lib/limits';
import type { PdfJob, JobResponse } from '../types';

const send = (response: JobResponse) => self.postMessage(response);
self.onmessage = async (event: MessageEvent<PdfJob>) => {
  try {
    const results = await processPdf(event.data, value => send({ type: 'progress', value }));
    send({ type: 'done', results });
  } catch (error) { send({ type: 'error', message: userError(error) }); }
};
