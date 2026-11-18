import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { PDFDocument, rgb } from 'pdf-lib';
import { openPdf, renderPage, canvasBytes } from '../lib/pdf-render';
import { parsePages } from '../lib/ranges';
import { MAX_OUTPUT_BYTES } from '../lib/limits';
import { embedFont, pdfResult } from './advanced-pdf';
import { checkAbort, pause, type AdvancedJob, type Progress } from './model';
import type { ResultFile } from '../types';

/** Bound expanded data BEFORE decompression, and strip every external relationship. */
export function safeOfficeZip(bytes: Uint8Array): Uint8Array {
  let total=0,count=0;
  const files=unzipSync(bytes,{filter:entry=>{
    total+=entry.originalSize;count++;
    if(total>100*1024*1024 || count>5000 || entry.originalSize>30*1024*1024) throw new Error('Document Office trop complexe ou trop volumineux après décompression.');
    if(!entry.name.endsWith('/') && /vbaProject|embeddings\//i.test(entry.name)) throw new Error('Les macros et objets incorporés ne sont pas pris en charge.');
    return true;
  }});
  if(!files['[Content_Types].xml']) throw new Error('Choisissez un fichier DOCX, XLSX ou PPTX valide. Les anciens formats DOC et PPT ne sont pas acceptés.');
  for(const [path,data] of Object.entries(files)) {
    if(/\.(xml|rels)$/.test(path)) {
      const text=strFromU8(data);
      if(/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Ce document contient une structure XML non autorisée.');
      if(path.endsWith('.rels')) files[path]=strToU8(text.replace(/<(?:\w+:)?Relationship\b[^>]*\bTargetMode\s*=\s*["']External["'][^>]*\/?\s*>/gi,''));
    }
  }
  return zipSync(files,{level:1});
}

async function canvasPage(pdf: PDFDocument, canvas: HTMLCanvasElement, width: number, height: number) {
  if(pdf.getPageCount()>=150) throw new Error('Limite de 150 pages par conversion.');
  const image=await pdf.embedJpg(await canvasBytes(canvas,'image/jpeg'));
  const page=pdf.addPage([width,height]);page.drawImage(image,{x:0,y:0,width,height});
}

export async function htmlOrWordPdf(job: AdvancedJob, progress: Progress, signal: AbortSignal): Promise<ResultFile[]> {
  const {default:html2canvas}=await import('html2canvas');
  const {default:purify}=await import('dompurify');
  const host=document.createElement('div');host.className='conversion-surface';
  // The imported markup never enters the interactive application surface.
  Object.assign(host.style,{position:'absolute',left:'-20000px',top:'0',width:'794px',color:'#111',background:'#fff',fontFamily:'Arial,sans-serif',fontSize:'15px',lineHeight:'1.5'});
  document.body.append(host);
  try {
    let sections: HTMLElement[];
    if(job.tool==='word-pdf') {
      const bytes=safeOfficeZip(job.files[0].bytes);
      const {renderAsync}=await import('docx-preview');
      await renderAsync(bytes,host,host,{className:'levisa-docx',ignoreFonts:true,useBase64URL:true,renderAltChunks:false,renderComments:false,renderChanges:false,ignoreLastRenderedPageBreak:false,breakPages:true,inWrapper:false});
      sections=Array.from(host.querySelectorAll<HTMLElement>('section.levisa-docx'));
      if(!sections.length) throw new Error('Aucune page lisible trouvée dans ce DOCX.');
    } else {
      const raw=new TextDecoder().decode(job.files[0].bytes);
      const safe=purify.sanitize(raw,{ALLOWED_TAGS:['h1','h2','h3','h4','p','div','span','br','strong','b','i','em','u','s','ul','ol','li','table','thead','tbody','tr','td','th','blockquote','pre','code','hr','img'],ALLOWED_ATTR:['style','src','alt','colspan','rowspan'],ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false,FORBID_ATTR:['srcset'],ALLOWED_URI_REGEXP:/^data:image\/(?:png|jpeg);base64,/i});
      const template=document.createElement('template');template.innerHTML=safe;
      for(const element of template.content.querySelectorAll<HTMLElement>('*')) {
        const old=element.getAttribute('style') || '';element.removeAttribute('style');
        // Only presentational, non-resource properties. No URL, position, animation or custom CSS.
        if(!/url\s*\(|@|\\/i.test(old)) for(const part of old.split(';')) {
          const colon=part.indexOf(':');const key=part.slice(0,colon).trim().toLowerCase(),value=part.slice(colon+1).trim();
          if(['color','background-color','text-align','font-weight','font-style','text-decoration','border','padding','margin','border-collapse'].includes(key)) element.style.setProperty(key,value);
        }
        if(element instanceof HTMLImageElement && !/^data:image\/(png|jpeg);base64,/i.test(element.getAttribute('src')||'')) element.removeAttribute('src');
      }
      host.style.padding='40px';host.style.boxSizing='border-box';host.append(template.content);
      sections=[host];
    }
    checkAbort(signal);
    const pdf=await PDFDocument.create();
    for(const [i,section] of sections.entries()) {
      for(const image of section.querySelectorAll('img')) await image.decode().catch(()=>{});
      const width=Math.ceil(section.getBoundingClientRect().width);
      const height=Math.ceil(Math.max(section.scrollHeight,section.getBoundingClientRect().height));
      if(width<1 || width>2400 || height>150*1123) throw new Error('Mise en page trop grande pour une conversion locale.');
      const pageHeight=Math.round(width*841.89/595.28);
      for(let offset=0;offset<height;offset+=pageHeight) {
        checkAbort(signal);if(pdf.getPageCount()>=150) throw new Error('Limite de 150 pages.');
        const sliceHeight=Math.min(pageHeight,height-offset);
        const rect=section.getBoundingClientRect();
        const canvas=await html2canvas(section,{scale:1.5,backgroundColor:'#fff',logging:false,useCORS:false,allowTaint:false,width,height:sliceHeight,x:0,y:offset,windowWidth:1200,windowHeight:1200,removeContainer:true});
        const page=pdf.addPage([595.28,841.89]);
        const image=await pdf.embedJpg(await canvasBytes(canvas,'image/jpeg'));
        const imageHeight=sliceHeight/width*595.28;page.drawImage(image,{x:0,y:841.89-imageHeight,width:595.28,height:imageHeight});
        canvas.width=canvas.height=0;await pause(signal);
      }
      progress(Math.round((i+1)/sections.length*90),'Création des pages PDF');
    }
    return [await pdfResult(pdf,job.tool==='word-pdf'?'levisa-word.pdf':'levisa-html.pdf')];
  } finally {host.replaceChildren();host.remove();}
}

export async function presentationPdf(job: AdvancedJob, progress: Progress, signal: AbortSignal): Promise<ResultFile[]> {
  const kit=await import('@office-kit/pptx'); const {renderSlideToSvg}=await import('@office-kit/pptx-preview');const {default:purify}=await import('dompurify');
  const deck=await kit.loadPresentation(safeOfficeZip(job.files[0].bytes));const slides=kit.getSlides(deck);
  if(!slides.length || slides.length>150) throw new Error('Choisissez une présentation de 1 à 150 diapositives.');
  const pdf=await PDFDocument.create();const canvas=document.createElement('canvas');const measure=document.createElement('canvas').getContext('2d')!;
  try {
    for(const [i,slide] of slides.entries()) {
      checkAbort(signal);
      const raw=renderSlideToSvg(deck,slide,{textLayout:'svg',resolveFamily:()=> 'Arial',measureText:(text,spec)=>{measure.font=`${spec.italic?'italic ':''}${spec.bold?'bold ':''}${spec.sizePx}px Arial`;return {widthPx:measure.measureText(text).width+Math.max(0,text.length-1)*spec.letterSpacingPx};}});
      const safe=purify.sanitize(raw,{USE_PROFILES:{svg:true,svgFilters:true},FORBID_TAGS:['foreignObject','script','a','animate','animateTransform','set'],ADD_DATA_URI_TAGS:['image']});
      // SVG is only decoded as an image (scripts and external resources cannot execute).
      const doc=new DOMParser().parseFromString(safe,'image/svg+xml');
      for(const el of doc.querySelectorAll('[href],[xlink\\:href]')) for(const attr of ['href','xlink:href']) {
        const value=el.getAttribute(attr);if(value && !value.startsWith('#') && !/^data:image\/(png|jpeg);base64,/i.test(value)) el.removeAttribute(attr);
      }
      const root=doc.documentElement;const box=(root.getAttribute('viewBox')||'0 0 1280 720').split(/[ ,]+/).map(Number);
      const width=box[2],height=box[3];if(!Number.isFinite(width*height) || width<=0 || height<=0 || width*height>12000000) throw new Error('Dimensions de diapositive non prises en charge.');
      const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc)],{type:'image/svg+xml'}));
      try {const image=new Image();image.src=url;await image.decode();canvas.width=Math.ceil(width*1.5);canvas.height=Math.ceil(height*1.5);const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);await canvasPage(pdf,canvas,width*.75,height*.75);} finally {URL.revokeObjectURL(url);}
      progress(Math.round((i+1)/slides.length*90),`Diapositive ${i+1} sur ${slides.length}`);await pause(signal);
    }
    return [await pdfResult(pdf,'levisa-powerpoint.pdf')];
  } finally {canvas.width=canvas.height=0;}
}

export async function spreadsheetPdf(job: AdvancedJob, progress: Progress, signal: AbortSignal): Promise<ResultFile[]> {
  const xlsx=await import('xlsx');const book=xlsx.read(safeOfficeZip(job.files[0].bytes),{type:'array',cellFormula:false,cellHTML:false,sheetRows:5001});
  const pdf=await PDFDocument.create();const font=await embedFont(pdf);
  for(const [n,name] of book.SheetNames.entries()) {
    const rows=xlsx.utils.sheet_to_json<string[]>(book.Sheets[name],{header:1,raw:false,defval:''});
    if(rows.length>5000 || rows.some(row=>row.length>100)) throw new Error('Limite locale : 5 000 lignes et 100 colonnes par feuille.');
    const cols=Math.max(1,...rows.map(r=>r.length));
    for(let col=0;col<cols;col+=6) {
      for(let start=0;start<Math.max(1,rows.length);start+=28) {
        checkAbort(signal);if(pdf.getPageCount()>=150) throw new Error('Le tableau dépasse 150 pages. Réduisez le classeur.');
        const page=pdf.addPage([841.89,595.28]);page.drawText(name.slice(0,70)+` · ${col+1}–${Math.min(col+6,cols)}`,{x:30,y:563,font,size:13});
        const cellW=780/Math.min(6,cols-col);
        for(let r=start;r<Math.min(start+28,rows.length);r++) for(let c=col;c<Math.min(col+6,cols);c++) {
          const x=30+(c-col)*cellW,y=532-(r-start)*17;
          page.drawRectangle({x,y:y-4,width:cellW,height:17,borderColor:rgb(.8,.8,.85),borderWidth:.4,color:r%2?rgb(.97,.97,.99):rgb(1,1,1)});
          const original=String(rows[r][c]??'').replace(/[\r\n]+/g,' ');let text=original;
          while(text.length && font.widthOfTextAtSize(text,8)>cellW-10) text=text.slice(0,-1);
          if(text!==original) text=text.slice(0,-1)+'…';page.drawText(text,{x:x+4,y,font,size:8});
        }
        await pause(signal);
      }
    }
    progress(Math.round((n+1)/book.SheetNames.length*90),'Conversion des feuilles');
  }
  return [await pdfResult(pdf,'levisa-excel.pdf')];
}

export type TextRow = { y:number; cells:{x:number;text:string;end:number}[] };
export function groupText(items: {str:string;transform:number[];width:number;height:number}[]): TextRow[] {
  const rows:TextRow[]=[];
  for(const item of items.filter(i=>i.str.trim()).sort((a,b)=>b.transform[5]-a.transform[5] || a.transform[4]-b.transform[4])) {
    let row=rows.find(r=>Math.abs(r.y-item.transform[5])<Math.max(2,item.height*.35));
    if(!row){row={y:item.transform[5],cells:[]};rows.push(row);} row.cells.push({x:item.transform[4],text:item.str,end:item.transform[4]+item.width});
  }
  for(const row of rows) row.cells.sort((a,b)=>a.x-b.x);
  return rows.sort((a,b)=>b.y-a.y);
}
export async function exportOffice(job: AdvancedJob, progress: Progress, signal: AbortSignal): Promise<ResultFile[]> {
  const pdf=await openPdf(job.files[0].bytes,signal);const selected=parsePages(job.options.range,pdf.numPages);
  try {
    if(job.tool==='pdf-ppt') {
      const {default:PptxGenJS}=await import('pptxgenjs');const deck=new PptxGenJS();deck.author='';deck.company='';deck.subject='Pages PDF sous forme d’images';deck.title='Document';
      const first=(await pdf.getPage(selected[0]+1)).getViewport({scale:1});deck.defineLayout({name:'PDF',width:first.width/72,height:first.height/72});deck.layout='PDF';
      const canvas=document.createElement('canvas');
      try {for(const [n,i] of selected.entries()) {await renderPage(pdf,i,canvas,job.options.scale,undefined,signal);const slide=deck.addSlide();const ratio=Math.min(first.width/canvas.width,first.height/canvas.height);slide.addImage({data:canvas.toDataURL('image/jpeg',.9),x:(first.width-canvas.width*ratio)/144,y:(first.height-canvas.height*ratio)/144,w:canvas.width*ratio/72,h:canvas.height*ratio/72});progress(Math.round((n+1)/selected.length*90));await pause(signal);}
        const blob=await deck.write({outputType:'blob'}) as Blob;if(blob.size>MAX_OUTPUT_BYTES) throw new Error('Le résultat dépasse 100 Mo.');return [{name:'levisa-pages.pptx',bytes:new Uint8Array(await blob.arrayBuffer()),mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}];
      } finally {canvas.width=canvas.height=0;}
    }
    const pages:TextRow[][]=[];let characters=0;
    for(const [n,i] of selected.entries()) {checkAbort(signal);const content=await (await pdf.getPage(i+1)).getTextContent();const items=content.items.filter((x):x is Extract<typeof x,{str:string}>=>'str' in x);pages.push(groupText(items));characters+=items.reduce((s,i)=>s+i.str.length,0);if(characters>1_000_000) throw new Error('Le texte dépasse la limite de conversion locale.');progress(Math.round((n+1)/selected.length*70));await pause(signal);}
    if(!characters) throw new Error('Ce PDF ne contient pas de texte extractible. Utilisez d’abord OCR PDF, puis convertissez le résultat.');
    if(job.tool==='pdf-word') {
      const {Document,Paragraph,TextRun,Packer}=await import('docx');
      const doc=new Document({creator:'',sections:pages.map(rows=>({children:rows.map(row=>new Paragraph({children:[new TextRun(row.cells.map(c=>c.text).join(' '))]}))}))});
      const blob=await Packer.toBlob(doc);return [{name:'levisa-texte.docx',bytes:new Uint8Array(await blob.arrayBuffer()),mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}];
    }
    const xlsx=await import('xlsx');const book=xlsx.utils.book_new();
    pages.forEach((rows,i)=>{
      const clustered=rows.map(row=>{const cells:{x:number;text:string;end:number}[]=[];for(const cell of row.cells){const last=cells.at(-1);if(last && cell.x-last.end<14){last.text+=' '+cell.text;last.end=cell.end;}else cells.push({...cell});}return cells;});
      const columns:number[]=[];for(const row of clustered) for(const cell of row) if(!columns.some(x=>Math.abs(x-cell.x)<12)) columns.push(cell.x);columns.sort((a,b)=>a-b);
      const data=clustered.map(row=>{const values:string[]=Array(columns.length).fill('');for(const cell of row){const c=columns.findIndex(x=>Math.abs(x-cell.x)<12);values[c]+=(values[c]?' ':'')+cell.text;}return values;});
      xlsx.utils.book_append_sheet(book,xlsx.utils.aoa_to_sheet(data),`Page ${selected[i]+1}`);
    });
    return [{name:'levisa-tableaux.xlsx',bytes:new Uint8Array(xlsx.write(book,{type:'array',bookType:'xlsx'})),mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}];
  } finally {await pdf.loadingTask.destroy();}
}


