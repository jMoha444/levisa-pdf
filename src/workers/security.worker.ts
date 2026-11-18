import createModule from '@soulehshaikh99/qpdf-wasm';
import wasmUrl from '@soulehshaikh99/qpdf-wasm/dist/qpdf.wasm?url';
self.onmessage = async ({data}: MessageEvent<{bytes: Uint8Array; mode: string; password: string}>) => {
  try {
    let log = '';
    const config = {locateFile:()=>wasmUrl,print:()=>{},printErr:(message: string)=>{log += message + '\n';}};
    const q = await createModule(config);
    q.FS.writeFile('/input.pdf',data.bytes);
    const args = data.mode === 'protect' ? ['/input.pdf','--encrypt',data.password,data.password,'256','--','/output.pdf']
      : data.mode === 'unlock' ? [`--password=${data.password}`,'--decrypt','/input.pdf','/output.pdf']
      : ['/input.pdf','--object-streams=generate','/output.pdf'];
    const code = q.callMain(args);
    if(code !== 0 && code !== 3) throw new Error(/password/i.test(log) ? 'Mot de passe incorrect ou manquant.' : 'Ce PDF ne peut pas être réparé ou ouvert. Les données manquantes ne peuvent pas être recréées.');
    if(data.mode === 'repair') {
      const checked = q.callMain(['--check','/output.pdf']);
      if(checked !== 0 && checked !== 3) throw new Error('La reconstruction ne donne pas un PDF valide. Conservez votre original.');
    }
    const bytes = q.FS.readFile('/output.pdf').slice();
    q.FS.unlink('/input.pdf'); q.FS.unlink('/output.pdf');
    self.postMessage({bytes,warning:code === 3}, {transfer:[bytes.buffer]});
  } catch(error) { self.postMessage({error: error instanceof Error ? error.message : 'Le traitement a échoué.'}); }
};

