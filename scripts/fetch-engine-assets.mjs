import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const assets = [
 ['https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf','public/engines/NotoSans-Regular.ttf'],
 ['https://raw.githubusercontent.com/notofonts/noto-fonts/main/LICENSE','public/licenses/NotoSans.txt'],
 ['https://registry.color.org/rgb-registry/profiles/sRGB2014.icc','public/engines/sRGB2014.icc'],
];
for(const [url, file] of assets){const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);const b=Buffer.from(await r.arrayBuffer());await mkdir(file.slice(0,file.lastIndexOf('/')),{recursive:true});await writeFile(file,b);console.log(file,b.length,createHash('sha256').update(b).digest('hex'));}
