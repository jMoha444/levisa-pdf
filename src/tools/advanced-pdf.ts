import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, degrees, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { parsePages } from '../lib/ranges';
import { MAX_OUTPUT_BYTES } from '../lib/limits';
import type { ResultFile } from '../types';
import { checkAbort, type AdvancedJob, type Field, type Mark, type Progress } from './model';

export async function embedFont(pdf: PDFDocument) {
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  const response = await fetch(`${import.meta.env.BASE_URL}engines/NotoSans-Regular.ttf`);
  if(!response.ok) throw new Error('La police locale est indisponible. Rechargez le site en ligne une première fois.');
  pdf.registerFontkit(fontkit);
  return pdf.embedFont(await response.arrayBuffer(),{subset:true});
}
export async function pdfResult(pdf: PDFDocument, name: string): Promise<ResultFile> {
  const bytes = await pdf.save();
  if(bytes.length > MAX_OUTPUT_BYTES) throw new Error('Le résultat dépasse 100 Mo. Réduisez le nombre de pages.');
  return {name,bytes,mime:'application/pdf'};
}
export function color(value: string) { return rgb(parseInt(value.slice(1,3),16)/255,parseInt(value.slice(3,5),16)/255,parseInt(value.slice(5,7),16)/255); }
export function geometry(page: PDFPage) {
  const box = page.getCropBox(); const angle = ((page.getRotation().angle % 360)+360)%360;
  const rotated = angle === 90 || angle === 270;
  return {width:rotated ? box.height : box.width,height:rotated ? box.width : box.height,angle,
    point:(x:number,y:number) => angle === 90 ? {x:box.x+y*box.width,y:box.y+x*box.height}
      : angle === 180 ? {x:box.x+(1-x)*box.width,y:box.y+y*box.height}
      : angle === 270 ? {x:box.x+(1-y)*box.width,y:box.y+(1-x)*box.height}
      : {x:box.x+x*box.width,y:box.y+(1-y)*box.height}};
}
export async function readFields(bytes: Uint8Array): Promise<Field[]> {
  const pdf = await PDFDocument.load(bytes,{updateMetadata:false});
  return pdf.getForm().getFields().map(field=> ({name:field.getName(),readOnly:field.isReadOnly(),
    type:field instanceof PDFTextField ? 'text' : field instanceof PDFCheckBox ? 'check' : field instanceof PDFDropdown || field instanceof PDFOptionList ? 'select' : 'unsupported',
    value:field instanceof PDFTextField ? field.getText() || '' : field instanceof PDFCheckBox ? String(field.isChecked()) : field instanceof PDFDropdown || field instanceof PDFOptionList ? field.getSelected().join(', ') : '',
    options:field instanceof PDFDropdown || field instanceof PDFOptionList ? field.getOptions() : undefined }));
}
export async function transformPdf(job: AdvancedJob, progress: Progress, signal?: AbortSignal): Promise<ResultFile[]> {
  const {tool,options:o} = job;
  const pdf = await PDFDocument.load(job.files[0].bytes,{updateMetadata:false,throwOnInvalidObject:true});
  const selected = parsePages(o.range,pdf.getPageCount());
  checkAbort(signal);
  if(tool === 'delete' || tool === 'extract') {
    if(!o.range.trim()) throw new Error('Indiquez les pages à '+(tool === 'delete' ? 'supprimer.' : 'extraire.'));
    const keep = tool === 'extract' ? selected : pdf.getPageIndices().filter(i=>!selected.includes(i));
    if(!keep.length) throw new Error('Conservez au moins une page.');
    const out = await PDFDocument.create();
    for(const page of await out.copyPages(pdf,keep)) out.addPage(page);
    return [await pdfResult(out,tool === 'delete' ? 'levisa-pages-conservees.pdf' : 'levisa-extrait.pdf')];
  }
  const font = ['numbers','watermark','edit','forms'].includes(tool) ? await embedFont(pdf) : undefined;
  if(tool === 'numbers' || tool === 'watermark') {
    if(tool === 'watermark' && !o.text.trim()) throw new Error('Saisissez le texte du filigrane.');
    for(const [n,i] of selected.entries()) {
      const page = pdf.getPage(i); const g = geometry(page);
      const text = tool === 'numbers' ? String(o.start+n) : o.text;
      const size = tool === 'watermark' ? Math.min(o.size,g.width/Math.max(1,font!.widthOfTextAtSize(text,1))*0.85) : o.size;
      const textWidth = font!.widthOfTextAtSize(text,size);
      const x = o.position.endsWith('left') ? 0.05 : o.position.endsWith('right') ? 0.95-textWidth/g.width : (1-textWidth/g.width)/2;
      const y = tool === 'watermark' ? 0.5 : o.position.startsWith('top') ? 0.05+size/g.height : 0.95;
      page.drawText(text,{...g.point(x,y),font,size,color:color(o.color),opacity:tool === 'watermark' ? o.opacity : 1,rotate:degrees(g.angle)});
    }
  }
  if(tool === 'crop') {
    const crop = o.marks.find(m=>m.kind === 'crop');
    if(!crop) throw new Error('Tracez la zone à conserver sur la page.');
    for(const index of o.allPages ? selected : [crop.page]) {
      const page = pdf.getPage(index); const g=geometry(page);
      const a=g.point(crop.x,crop.y); const b=g.point(crop.x+crop.w,crop.y+crop.h);
      page.setCropBox(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));
    }
  }
  if(tool === 'forms') {
    const form = pdf.getForm();
    for(const value of o.fields) {
      if(value.readOnly || value.type === 'unsupported') continue;
      const field = form.getField(value.name);
      if(field instanceof PDFTextField) field.setText(value.value);
      if(field instanceof PDFCheckBox) value.value === 'true' ? field.check() : field.uncheck();
      if(field instanceof PDFDropdown || field instanceof PDFOptionList) { field.clear(); if(value.value) field.select(value.value); }
    }
  }
  if(['edit','sign','forms'].includes(tool)) {
    if(tool !== 'forms' && !o.marks.length) throw new Error('Ajoutez au moins un élément sur le document.');
    for(const mark of o.marks) {
      checkAbort(signal); const page=pdf.getPage(mark.page); const g=geometry(page); const p=g.point(mark.x,mark.y+mark.h);
      if(mark.kind === 'text') page.drawText(mark.text,{...p,font:font!,size:mark.size,color:color(mark.color),rotate:degrees(g.angle),maxWidth:mark.w*g.width,lineHeight:mark.size*1.2});
      if(mark.kind === 'image' && mark.image) {
        const image = mark.image[0] === 0x89 ? await pdf.embedPng(mark.image) : await pdf.embedJpg(mark.image);
        page.drawImage(image,{...p,width:mark.w*g.width,height:mark.h*g.height,rotate:degrees(g.angle)});
      }
      if(mark.kind === 'field' || mark.kind === 'checkbox') {
        if(g.angle !== 0) throw new Error('Pour créer des champs, utilisez une page sans rotation. Vous pouvez d’abord l’exporter en image puis la reconvertir en PDF.');
        const name = mark.text.trim() || `Champ-${mark.id}`;
        if(pdf.getForm().getFieldMaybe(name)) throw new Error('Chaque champ doit avoir un nom unique : '+name);
        const field = mark.kind === 'checkbox' ? pdf.getForm().createCheckBox(name) : pdf.getForm().createTextField(name);
        field.addToPage(page,{...p,width:mark.w*g.width,height:mark.h*g.height,borderWidth:1,borderColor:rgb(.45,.4,.75)});
      }
    }
  }
  if(tool === 'forms') { pdf.getForm().updateFieldAppearances(font); if(o.flatten) pdf.getForm().flatten(); }
  progress(90,'Préparation du PDF');
  return [await pdfResult(pdf,`levisa-${tool}.pdf`)];
}

export async function securePdf(job: AdvancedJob, signal: AbortSignal): Promise<ResultFile[]> {
  const o=job.options;
  if(job.tool === 'protect' && (o.password.length < 8 || o.password !== o.confirm)) throw new Error('Choisissez au moins 8 caractères et une confirmation identique.');
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('../workers/security.worker.ts',import.meta.url),{type:'module'});
    const cleanup=()=>{clearTimeout(timer);worker.terminate();signal.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();reject(new Error('Opération annulée.'));};
    const timer=setTimeout(()=>{cleanup();reject(new Error('Le traitement prend trop de temps. Essayez un document plus petit.'));},120000);
    signal.addEventListener('abort',abort,{once:true});
    worker.onerror=()=>{cleanup();reject(new Error('Le moteur PDF n’a pas pu démarrer. Rechargez le site.'));};
    worker.onmessage=({data})=>{cleanup();if(data.error) reject(new Error(data.error));else if(data.bytes.length>MAX_OUTPUT_BYTES) reject(new Error('Le résultat dépasse 100 Mo.'));else resolve([{name:`levisa-${job.tool}.pdf`,bytes:data.bytes,mime:'application/pdf'}]);};
    if(signal.aborted) return abort();
    worker.postMessage({bytes:job.files[0].bytes,mode:job.tool,password:o.password});
  });
}
