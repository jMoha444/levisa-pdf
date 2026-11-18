import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { openPdf, renderPage, canvasBytes } from '../lib/pdf-render';
import { parsePages } from '../lib/ranges';
import { MAX_OUTPUT_BYTES, sniffFile, validateImageDimensions } from '../lib/limits';
import type { ResultFile } from '../types';
import { checkAbort, pause, type AdvancedJob, type Progress } from './model';
import { pdfResult } from './advanced-pdf';
import { addArchivalMetadata } from './pdfa';

export async function rasterPdf(job: AdvancedJob, progress: Progress, signal: AbortSignal): Promise<ResultFile[]> {
  const {tool,options:o}=job;
  const source=await openPdf(job.files[0].bytes,signal);
  const pdf=await PDFDocument.create({updateMetadata:false});
  const canvas=document.createElement('canvas');
  let ocr: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>> | undefined;
  const abort=()=>{void ocr?.terminate();}; signal.addEventListener('abort',abort,{once:true});
  try {
    if(tool === 'redact' && !o.marks.some(m=>m.kind === 'redact')) throw new Error('Tracez les zones à censurer sur les pages.');
    const selected=tool === 'ocr' ? parsePages(o.range,source.numPages) : Array.from({length:source.numPages},(_,i)=>i);
    if(tool === 'ocr') {
      progress(2,'Chargement de la reconnaissance locale…');
      const {createWorker}=await import('tesseract.js');
      const base=new URL(import.meta.env.BASE_URL,location.origin).href;
      ocr=await createWorker(o.language.split('+'),1,{workerPath:base+'engines/ocr/worker.min.js',corePath:base+'engines/ocr/core/',langPath:base+'engines/ocr/lang',cacheMethod:'none',workerBlobURL:false,logger:()=>{}});
      checkAbort(signal);
    }
    for(const [n,index] of selected.entries()) {
      await pause(signal);
      const page=await source.getPage(index+1); const view=page.getViewport({scale:1});
      if(view.width<3 || view.height<3 || view.width>14400 || view.height>14400) throw new Error('Dimensions de page non prises en charge.');
      await renderPage(source,index,canvas,tool === 'ocr' ? 2 : o.scale,undefined,signal);
      if(tool === 'redact') {
        const ctx=canvas.getContext('2d')!; ctx.fillStyle='#000';
        for(const m of o.marks.filter(m=>m.page===index && m.kind==='redact')) {
          const x=Math.floor(m.x*canvas.width),y=Math.floor(m.y*canvas.height);
          ctx.fillRect(x,y,Math.ceil((m.x+m.w)*canvas.width)-x,Math.ceil((m.y+m.h)*canvas.height)-y);
        }
      }
      if(ocr) {
        const result=await ocr.recognize(canvas,{pdfTextOnly:false},{pdf:true});
        checkAbort(signal);
        if(!result.data.pdf) throw new Error('La reconnaissance n’a pas pu produire de PDF.');
        const recognized=await PDFDocument.load(new Uint8Array(result.data.pdf));
        const [copy]=await pdf.copyPages(recognized,[0]);
        copy.scale(view.width/copy.getWidth(),view.height/copy.getHeight());pdf.addPage(copy);
      } else {
        // PNG is lossless for redaction, so edge pixels cannot reveal removed content.
        const image=tool === 'redact' ? await pdf.embedPng(await canvasBytes(canvas,'image/png')) : await pdf.embedJpg(await canvasBytes(canvas,'image/jpeg'));
        const p=pdf.addPage([view.width,view.height]); p.drawImage(image,{x:0,y:0,width:view.width,height:view.height});
      }
      progress(10+Math.round((n+1)/selected.length*80),`Page ${n+1} sur ${selected.length}`);
    }
    if(tool === 'pdf-a') {
      const r=await fetch(`${import.meta.env.BASE_URL}engines/sRGB2014.icc`,{signal});
      if(!r.ok) throw new Error('Le profil colorimétrique local est indisponible.');
      addArchivalMetadata(pdf,new Uint8Array(await r.arrayBuffer()),crypto.randomUUID().replaceAll('-',''));
      const bytes=await pdf.save({useObjectStreams:false,addDefaultPage:false});
      if(bytes.length>MAX_OUTPUT_BYTES) throw new Error('Le résultat dépasse 100 Mo. Réduisez la résolution.');
      return [{name:'levisa-archivage-pdfa-2b.pdf',bytes,mime:'application/pdf'}];
    }
    return [await pdfResult(pdf,`levisa-${tool}.pdf`)];
  } finally {signal.removeEventListener('abort',abort);await ocr?.terminate();await source.loadingTask.destroy();canvas.width=canvas.height=0;}
}

export async function scanPdf(job: AdvancedJob, progress: Progress, signal: AbortSignal): Promise<ResultFile[]> {
  const pdf=await PDFDocument.create(); const o=job.options;
  const canvas=document.createElement('canvas');
  try {
    for(const [n,file] of job.files.entries()) {
      checkAbort(signal); const kind=sniffFile(file.bytes);
      if(kind !== 'png' && kind !== 'jpg') throw new Error('Choisissez une photo JPG ou PNG.');
      validateImageDimensions(file.bytes,kind);
      const image=await createImageBitmap(new Blob([file.bytes as BlobPart]));
      const factor=Math.min(1,2400/Math.max(image.width,image.height));
      const w=image.width*factor,h=image.height*factor;
      const rotate=o.scanRotation % 180 !== 0;
      canvas.width=Math.round(rotate?h:w); canvas.height=Math.round(rotate?w:h);
      const ctx=canvas.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(o.scanRotation*Math.PI/180);ctx.drawImage(image,-w/2,-h/2,w,h);ctx.restore();image.close();
      if(o.scanMode !== 'color') {
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
        for(let k=0;k<pixels.data.length;k+=4) {let v=.299*pixels.data[k]+.587*pixels.data[k+1]+.114*pixels.data[k+2];if(o.scanMode==='bw') v=v>155?255:0;pixels.data[k]=pixels.data[k+1]=pixels.data[k+2]=v;}
        ctx.putImageData(pixels,0,0);
      }
      const trim=Math.min(.35,Math.max(0,o.scanMargin/100));
      const crop=document.createElement('canvas');crop.width=Math.round(canvas.width*(1-2*trim));crop.height=Math.round(canvas.height*(1-2*trim));
      crop.getContext('2d')!.drawImage(canvas,canvas.width*trim,canvas.height*trim,crop.width,crop.height,0,0,crop.width,crop.height);
      const embedded=await pdf.embedJpg(await canvasBytes(crop,'image/jpeg'));
      const page=pdf.addPage([595.28,841.89]);const scale=Math.min(555/embedded.width,801/embedded.height);
      page.drawImage(embedded,{x:(595.28-embedded.width*scale)/2,y:(841.89-embedded.height*scale)/2,width:embedded.width*scale,height:embedded.height*scale});
      crop.width=crop.height=0; progress(Math.round((n+1)/job.files.length*90),`Photo ${n+1} sur ${job.files.length}`);await pause(signal);
    }
    return [await pdfResult(pdf,'levisa-numerisation.pdf')];
  } finally {canvas.width=canvas.height=0;}
}

export async function comparePdf(job: AdvancedJob, progress: Progress, signal: AbortSignal): Promise<ResultFile[]> {
  if(job.files.length !== 2) throw new Error('Ajoutez deux PDF à comparer.');
  const a=await openPdf(job.files[0].bytes,signal); let b;
  const left=document.createElement('canvas'),right=document.createElement('canvas'),diff=document.createElement('canvas');
  try {
    b=await openPdf(job.files[1].bytes,signal); const out=await PDFDocument.create(); const font=await out.embedFont(StandardFonts.Helvetica);
    const summary:string[]=['LEVISA PDF - comparaison visuelle','Page;Pixels differents (%);Etat'];
    const count=Math.max(a.numPages,b.numPages);
    for(let i=0;i<count;i++) {
      checkAbort(signal);
      for(const [pdf,canvas] of [[a,left],[b,right]] as const) {
        if(i<pdf.numPages) await renderPage(pdf,i,canvas,.8,undefined,signal);
        else {canvas.width=400;canvas.height=565;const ctx=canvas.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,400,565);}
      }
      diff.width=Math.max(left.width,right.width);diff.height=Math.max(left.height,right.height);
      if(diff.width*diff.height>12000000) throw new Error('Page trop grande pour la comparaison.');
      const ctx=diff.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,diff.width,diff.height);ctx.drawImage(left,0,0);
      const l=ctx.getImageData(0,0,diff.width,diff.height);ctx.fillStyle='white';ctx.fillRect(0,0,diff.width,diff.height);ctx.drawImage(right,0,0);
      const r=ctx.getImageData(0,0,diff.width,diff.height);let changed=0;
      for(let k=0;k<l.data.length;k+=4) {
        const delta=Math.max(Math.abs(l.data[k]-r.data[k]),Math.abs(l.data[k+1]-r.data[k+1]),Math.abs(l.data[k+2]-r.data[k+2]));
        if(delta>job.options.threshold) {changed++;l.data[k]=230;l.data[k+1]=45;l.data[k+2]=110;} else {const gray=(l.data[k]+l.data[k+1]+l.data[k+2])/3*.25+190;l.data[k]=l.data[k+1]=l.data[k+2]=gray;}
      }
      ctx.putImageData(l,0,0);const percent=changed/(diff.width*diff.height)*100;
      const state=i>=a.numPages || i>=b.numPages ? 'Page absente' : left.width!==right.width || left.height!==right.height ? 'Dimensions differentes' : percent===0 ? 'Identique au seuil choisi' : 'Differences visuelles';
      const page=out.addPage([1000,580]);page.drawText(`Page ${i+1} | ${percent.toFixed(2)} % | ${state}`,{x:24,y:550,size:14,font});
      const canvases=[left,right,diff];
      for(let j=0;j<3;j++) {const c=canvases[j];const image=await out.embedPng(await canvasBytes(c,'image/png'));const s=Math.min(306/c.width,486/c.height);page.drawImage(image,{x:24+j*326,y:36,width:c.width*s,height:c.height*s});page.drawText(['Document A','Document B','Differences en rose'][j],{x:24+j*326,y:520,size:11,font,color:rgb(.3,.3,.4)});}
      summary.push(`${i+1};${percent.toFixed(4)};${state}`);progress(Math.round((i+1)/count*90),`Comparaison ${i+1} sur ${count}`);await pause(signal);
    }
    return [await pdfResult(out,'levisa-comparaison.pdf'),{name:'levisa-comparaison.csv',bytes:new TextEncoder().encode('\uFEFF'+summary.join('\r\n')),mime:'text/csv;charset=utf-8'}];
  } finally {await a.loadingTask.destroy();await b?.loadingTask.destroy();for(const c of [left,right,diff]) c.width=c.height=0;}
}

