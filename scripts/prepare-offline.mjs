import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const out = path.join(root, 'dist');
const base = process.env.BASE_PATH || '/';
if (!/^\/(?:[A-Za-z0-9_.-]+\/)*$/.test(base)) throw new Error('BASE_PATH must be an absolute path ending in /.');
const require = createRequire(import.meta.url);
// Engine assets are served locally, never from third-party CDNs at runtime.
const ocr = path.dirname(require.resolve('tesseract.js/package.json'));
const ocrRequire = createRequire(path.join(ocr, 'package.json'));
const core = path.dirname(ocrRequire.resolve('tesseract.js-core/package.json'));
await mkdir(path.join(out,'engines/ocr/core'),{recursive:true});
await mkdir(path.join(out,'engines/ocr/lang'),{recursive:true});
await cp(path.join(ocr,'dist/worker.min.js'),path.join(out,'engines/ocr/worker.min.js'));
for (const name of await readdir(core)) if(name.includes('lstm') && /\.(js|wasm)$/.test(name)) await cp(path.join(core,name),path.join(out,'engines/ocr/core',name));
for (const lang of ['fra','eng']) {
  const dir=path.dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));
  await cp(path.join(dir,'4.0.0',`${lang}.traineddata.gz`),path.join(out,'engines/ocr/lang',`${lang}.traineddata.gz`));
}
const pdfjs = path.dirname(require.resolve('pdfjs-dist/package.json'));
await mkdir(path.join(out, 'pdfjs'), { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) await cp(path.join(pdfjs, folder), path.join(out, 'pdfjs', folder), { recursive: true });
await cp(path.join(pdfjs, 'LICENSE'), path.join(out, 'pdfjs', 'LICENSE'));
await mkdir(path.join(out, 'licenses'), { recursive: true });
for (const [pkg, filename] of [
  ['react', 'LICENSE'], ['react-dom', 'LICENSE'], ['pdf-lib', 'LICENSE.md'],
  ['fflate', 'LICENSE'], ['lucide-react', 'LICENSE'],
  ['@fontsource-variable/manrope', 'LICENSE'], ['@fontsource-variable/inter', 'LICENSE'],
  ['tesseract.js','LICENSE.md'], ['@soulehshaikh99/qpdf-wasm','LICENSE'],
  ['docx','LICENSE'], ['docx-preview','LICENSE'], ['dompurify','LICENSE'], ['html2canvas','LICENSE'],
  ['pptxgenjs','LICENSE'], ['xlsx','LICENSE'], ['@office-kit/pptx','LICENSE'], ['@office-kit/pptx-preview','LICENSE'],
]) {
  const directory = path.join(root, "node_modules", pkg);
  await cp(path.join(directory, filename), path.join(out, 'licenses', pkg.replaceAll('/', '-').replace('@', '') + '.txt'));
}

// Rasterize the geometric brand mark locally; no remote image or font requests.
function crc32(buffer) {
  let c = 0xffffffff;
  for (const b of buffer) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(name, data) { const tag = Buffer.from(name); const header = Buffer.alloc(4); header.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tag, data]))); return Buffer.concat([header, tag, data, crc]); }
for (const size of [192, 512]) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x / size * 192; const py = y / size * 192;
    let color = [105, 80, 223, 255];
    if ((px >= 57 && px < 84 && py >= 46 && py < 145) || (px >= 57 && px < 135 && py >= 119 && py < 145)) color = [255, 255, 255, 255];
    else if (px >= 105 && px < 135 && py >= 46 && py < 99) color = [197, 186, 255, 255];
    const index = y * (size * 4 + 1) + 1 + x * 4;
    raw.set(color, index);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  await writeFile(path.join(out, `icon-${size}.png`), png);
}
async function walk(folder) {
  const result = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const filename = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await walk(filename));
    else result.push(filename);
  }
  return result;
}
const files = (await walk(out)).filter(file => !['sw.js', '_headers'].includes(path.basename(file)) && !file.endsWith('.map'));
// Some static hosts redirect /index.html to /. Cache the canonical navigation
// URL, since a redirected Response cannot satisfy an offline navigation.
const assets = files.map(file => {
  const relative = path.relative(out, file).replaceAll('\\', '/');
  return relative === 'index.html' ? base : base + relative;
}).sort();
const hash = createHash('sha256');
hash.update(await readFile(new URL(import.meta.url)));
hash.update(JSON.stringify(assets));
for (const file of files.sort()) hash.update(await readFile(file));
const version = hash.digest('hex').slice(0, 16);
await writeFile(path.join(out, 'sw.js'), `// Generated allowlist: only immutable application resources, never user documents.
const BASE = ${JSON.stringify(base)};
const PREFIX = 'levisa-static-' + encodeURIComponent(BASE) + '-';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(assets)};
const ALLOWED = new Set(ASSETS);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith(PREFIX) || (BASE === '/' && /^levisa-static-[a-f0-9]{16}$/.test(key))) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search) return;
  const asset = request.mode === 'navigate' && (url.pathname === BASE || url.pathname === BASE + 'index.html') ? BASE : url.pathname;
  if (!ALLOWED.has(asset)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(asset)).then(cached => cached || fetch(request)));
});
`);
console.log(`Offline shell: ${assets.length} application assets. Version ${version}. No document caching.`);


