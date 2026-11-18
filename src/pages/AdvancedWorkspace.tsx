import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Check, ChevronLeft, ChevronRight, FilePlus2, Info, LoaderCircle, LockKeyhole, Plus, ShieldCheck, Trash2, Undo2, Upload, Camera } from 'lucide-react';
import { getTool } from '../lib/tools';
import { openPdf, renderPage } from '../lib/pdf-render';
import { formatBytes, sniffFile, validateFiles, validateImageDimensions } from '../lib/limits';
import { DownloadLink } from '../components/Download';
import { createArchive } from '../lib/archive';
import { defaultOptions, type AdvancedOptions, type InputFile, type Mark } from '../tools/model';
import type { ResultFile, ToolId } from '../types';

const notes: Partial<Record<ToolId,string>> = {
  'word-pdf':'DOCX uniquement. Le rendu devient une image par page. Les sauts de page et mises en page complexes peuvent différer de Word ; vérifiez l’aperçu du résultat.',
  'ppt-pdf':'PPTX uniquement. Les diapositives deviennent des images. Certaines polices, animations, vidéos, graphiques et effets avancés ne sont pas reproduits fidèlement.',
  'excel-pdf':'XLSX uniquement. Export des valeurs enregistrées, sans recalcul des formules ni graphiques. 6 colonnes et 28 lignes par page ; les cellules trop longues sont abrégées. Conservez le classeur original.',
  'html-pdf':'Importez un fichier HTML local. Le texte, les tableaux, les images PNG/JPG intégrées et les styles simples sont conservés. Scripts, liens et ressources distantes sont retirés. Résultat en images.',
  'pdf-word':'Le texte est reconstruit en paragraphes modifiables. La mise en page, les images et les tableaux d’origine ne sont pas reproduits. Pour un scan, utilisez d’abord OCR PDF.',
  'pdf-excel':'Les lignes et colonnes sont déduites de la position du texte. Le résultat nécessite une vérification ; ce n’est pas une reconnaissance automatique fiable de tous les tableaux. Les valeurs restent du texte.',
  'pdf-ppt':'Chaque page devient une image dans une diapositive. Le texte et les objets ne sont pas modifiables séparément. Les pages de tailles différentes sont centrées sans déformation.',
  'pdf-a':'PDF/A-2b aplati : les pages deviennent des images avec un profil sRGB intégré. Le texte n’est plus sélectionnable ; formulaires, liens et signatures sont retirés. Le navigateur ne réalise pas de certification individuelle.',
  'ocr':'Reconnaissance locale en français et anglais. Le premier chargement télécharge le moteur et les langues depuis ce site. Relisez le texte reconnu, notamment les chiffres et les noms.',
  'repair':'Réparation de la structure seulement, sans garantie : les éléments absents ou détruits ne peuvent pas être recréés. Comparez le résultat avec votre original.',
  'unlock':'Le mot de passe est nécessaire lorsque le PDF en exige un. Il reste uniquement en mémoire et sera effacé après le traitement.',
  'protect':'Un mot de passe d’ouverture chiffre le PDF en AES-256. Conservez-le : LEVISA PDF ne peut pas le retrouver. La modification invalide une éventuelle signature numérique existante.',
  'sign':'Signature visuelle dessinée ou importée. Elle ne constitue pas une signature numérique avec certificat. Elle peut être copiée comme toute image du document.',
  'redact':'Toutes les pages sont reconstruites en images après masquage. Le texte, les calques, pièces jointes, formulaires et métadonnées d’origine ne sont pas recopiés. Inspectez chaque zone avant de partager le résultat.',
  'crop':'Le rognage change la zone visible, sans supprimer le contenu situé en dehors. Pour supprimer une information confidentielle, utilisez Censurer PDF.',
  'edit':'Ajout de texte et d’images. Le texte déjà présent n’est pas remplacé. Pour supprimer définitivement du contenu, utilisez Censurer PDF.',
  'forms':'Champs AcroForm : texte, cases à cocher et listes. Les champs en lecture seule, signatures, boutons et formulaires XFA ne sont pas modifiés. Les calculs et scripts du formulaire ne sont pas exécutés.',
  'compare':'Comparaison visuelle, à résolution réduite. Les différences sont indiquées en rose dans un rapport PDF. Elle ne compare pas les métadonnées, pièces jointes ou signatures.',
  'scan':'Sur mobile, le bouton Appareil photo ouvre la capture si le navigateur le permet. Réordonnez les photos ; la rotation, le recadrage et le filtre s’appliquent à toutes les images.',
};
const formats: Partial<Record<ToolId,string>> = {'word-pdf':'.docx','ppt-pdf':'.pptx','excel-pdf':'.xlsx','html-pdf':'.html,.htm','scan':'.jpg,.jpeg,.png,image/jpeg,image/png'};
const visualTools=new Set<ToolId>(['crop','redact','edit','sign','forms']);

function PdfCanvas({pdf,index,onSize}:{pdf:PDFDocumentProxy;index:number;onSize:(size:{width:number;height:number})=>void}) {
  const ref=useRef<HTMLCanvasElement>(null);const [error,setError]=useState('');
  useEffect(()=>{const abort=new AbortController();setError('');void renderPage(pdf,index,ref.current!,1,undefined,abort.signal).then(()=>{if(!abort.signal.aborted)onSize({width:ref.current!.width,height:ref.current!.height});}).catch(e=>{if(!abort.signal.aborted)setError(String(e.message));});return ()=>abort.abort();},[pdf,index,onSize]);
  return <>{error && <p role="alert">{error}</p>}<canvas ref={ref} aria-label={`Aperçu de la page ${index+1}`} /></>;
}
function ImagePreview({file}:{file:InputFile}) {
  const [url,setUrl]=useState('');useEffect(()=>{const value=URL.createObjectURL(new Blob([file.bytes as BlobPart]));setUrl(value);return ()=>URL.revokeObjectURL(value);},[file]);
  return <img src={url || undefined} alt={file.name} />;
}
function SignaturePad({onSave}:{onSave:(bytes:Uint8Array)=>void}) {
  const ref=useRef<HTMLCanvasElement>(null),drawing=useRef(false),hasInk=useRef(false);
  const point=(event:ReactPointerEvent<HTMLCanvasElement>)=>{const r=event.currentTarget.getBoundingClientRect();return {x:(event.clientX-r.left)/r.width*600,y:(event.clientY-r.top)/r.height*180};};
  return <div className="signature-pad"><p>Dessinez votre signature</p><canvas ref={ref} width={600} height={180} aria-label="Zone pour dessiner votre signature" onPointerDown={e=>{drawing.current=true;hasInk.current=true;e.currentTarget.setPointerCapture(e.pointerId);const ctx=e.currentTarget.getContext('2d')!,p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.strokeStyle='#19152d';ctx.lineWidth=3;ctx.lineCap='round';}} onPointerMove={e=>{if(!drawing.current)return;const p=point(e),ctx=e.currentTarget.getContext('2d')!;ctx.lineTo(p.x,p.y);ctx.stroke();}} onPointerUp={()=>{drawing.current=false;}} onPointerCancel={()=>{drawing.current=false;}}/><div><button className="button small secondary" type="button" onClick={()=>{ref.current?.getContext('2d')?.clearRect(0,0,600,180);hasInk.current=false;}}>Effacer</button><button className="button small primary" type="button" onClick={()=>{if(!hasInk.current)return;ref.current!.toBlob(async blob=>{if(blob)onSave(new Uint8Array(await blob.arrayBuffer()));},'image/png');}}>Utiliser cette signature</button></div></div>;
}

export function AdvancedWorkspace({toolId}:{toolId:ToolId}) {
  const tool=getTool(toolId),isOffice=!!formats[toolId] && toolId!=='scan',multiple=toolId==='scan'||toolId==='compare';
  const input=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null),stampInput=useRef<HTMLInputElement>(null);
  const abort=useRef(new AbortController()),generation=useRef(0),active=useRef(false),pdfRef=useRef<PDFDocumentProxy|null>(null);
  const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[files,setFiles]=useState<InputFile[]>([]),[options,setOptions]=useState<AdvancedOptions>({...defaultOptions,text:toolId==='watermark'?'CONFIDENTIEL':'Votre texte',size:toolId==='watermark'?52:16});
  const [results,setResults]=useState<ResultFile[]>([]),[archive,setArchive]=useState<ResultFile|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState(0),[status,setStatus]=useState(''),[page,setPage]=useState(0),[drag,setDrag]=useState(false);
  const [markType,setMarkType]=useState<Mark['kind']>(toolId==='crop'?'crop':toolId==='redact'?'redact':toolId==='forms'?'field':toolId==='sign'?'image':'text');
  const [stamp,setStamp]=useState<Uint8Array|null>(null),[stampRatio,setStampRatio]=useState(3.33),[draft,setDraft]=useState<Mark|null>(null);
  const [pageSize,setPageSize]=useState({width:595,height:842});
  const start=useRef<{x:number;y:number}|null>(null);const visual=visualTools.has(toolId);
  const patch=(value:Partial<AdvancedOptions>)=>setOptions(o=>({...o,...value}));
  const release=()=>{void pdfRef.current?.loadingTask.destroy();pdfRef.current=null;setPdf(null);};
  const reset=()=>{generation.current++;abort.current.abort();abort.current=new AbortController();active.current=false;release();setFiles([]);setResults([]);setArchive(null);setError('');setBusy(false);setLoading(false);setStamp(null);setDraft(null);setPage(0);setOptions(o=>({...o,password:'',confirm:'',marks:[],fields:[],range:''}));if(input.current)input.current.value='';};
  useEffect(()=>{const hide=()=>reset();window.addEventListener('pagehide',hide);return ()=>{generation.current++;abort.current.abort();void pdfRef.current?.loadingTask.destroy();window.removeEventListener('pagehide',hide);};},[]);
  const add=async(incoming:File[])=>{
    if(active.current||!incoming.length)return;active.current=true;setLoading(true);setError('');const current=generation.current;let opened:PDFDocumentProxy|null=null;
    try {
      const existing=multiple?files:[];
      if(!multiple&&incoming.length>1)throw new Error('Choisissez un seul fichier pour cet outil.');
      if(toolId==='compare'&&existing.length+incoming.length>2)throw new Error('La comparaison accepte exactement deux PDF.');
      validateFiles(incoming,existing.reduce((s,f)=>s+f.bytes.length,0),existing.length);
      const added:InputFile[]=[];
      for(const file of incoming) {
        const bytes=new Uint8Array(await file.arrayBuffer());if(current!==generation.current)return;
        if(isOffice) {const extension=file.name.split('.').at(-1)?.toLowerCase();if(!formats[toolId]!.split(',').includes('.'+extension))throw new Error('Format attendu : '+formats[toolId]);}
        else if(toolId==='scan'){const kind=sniffFile(bytes);if(kind!=='png'&&kind!=='jpg')throw new Error('Choisissez une photo JPG ou PNG.');validateImageDimensions(bytes,kind);}
        else if(sniffFile(bytes)!=='pdf')throw new Error('Choisissez un document PDF valide.');
        added.push({name:file.name,bytes});
      }
      const next=[...existing,...added];
      if(!isOffice && toolId!=='scan' && toolId!=='repair' && toolId!=='unlock') {
        opened=await openPdf(next[0].bytes,abort.current.signal);
        if(await opened.getPermissions()!==null)throw new Error('Ouvrez d’abord ce fichier avec Déverrouiller PDF.');
      }
      let fields=options.fields;if(toolId==='forms')fields=await (await import('../tools/advanced-pdf')).readFields(next[0].bytes);
      if(current!==generation.current)return;
      release();pdfRef.current=opened;setPdf(opened);opened=null;setFiles(next);setPage(0);patch({marks:[],fields});
    } catch(e){if(current===generation.current)setError(e instanceof Error && /password/i.test(e.name+e.message)?'Ce PDF est protégé. Utilisez d’abord Déverrouiller PDF.':e instanceof Error?e.message:'Impossible de lire ce fichier.');}
    finally {await opened?.loadingTask.destroy();if(current===generation.current){active.current=false;setLoading(false);}if(input.current)input.current.value='';}
  };
  const chooseStamp=async(bytes:Uint8Array)=>{const kind=sniffFile(bytes);if(kind!=='png'&&kind!=='jpg')throw new Error('La signature ou l’image doit être un PNG ou JPG.');validateImageDimensions(bytes,kind);const image=await createImageBitmap(new Blob([bytes as BlobPart]));setStampRatio(image.width/image.height);image.close();setStamp(bytes);setMarkType('image');};
  const point=(e:ReactPointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect();return {x:Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),y:Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))};};
  const begin=(e:ReactPointerEvent<HTMLDivElement>)=>{
    if(!visual||busy||loading||results.length)return;
    e.preventDefault();setError('');const p=point(e);
    if(markType==='text'||markType==='image') {
      if(markType==='text'&&!options.text.trim()){setError('Saisissez le texte à ajouter.');return;}
      if(markType==='image'&&!stamp){setError('Dessinez ou importez une signature ou une image.');return;}
      const rect=e.currentTarget.getBoundingClientRect();const width=markType==='image'?.3:Math.min(.8,Math.max(.2,options.text.length*options.size*.55/pageSize.width));
      const height=markType==='image'?width*rect.width/rect.height/stampRatio:options.size*1.35/pageSize.height;
      const mark:Mark={id:crypto.randomUUID(),page,x:Math.min(p.x,1-width),y:Math.min(p.y,1-height),w:width,h:height,kind:markType,text:options.text,size:options.size,color:options.color,image:stamp||undefined};
      patch({marks:[...options.marks,mark]});return;
    }
    start.current=p;e.currentTarget.setPointerCapture(e.pointerId);
  };
  const draw=(e:ReactPointerEvent<HTMLDivElement>)=>{if(!start.current)return;const p=point(e),s=start.current;setDraft({id:'draft',page,x:Math.min(p.x,s.x),y:Math.min(p.y,s.y),w:Math.abs(p.x-s.x),h:Math.abs(p.y-s.y),kind:markType,text:options.text,size:options.size,color:options.color});};
  const end=(e:ReactPointerEvent<HTMLDivElement>)=>{if(!start.current)return;const p=point(e),s=start.current;start.current=null;setDraft(null);const w=Math.abs(p.x-s.x),h=Math.abs(p.y-s.y);if(w<.01||h<.01)return;const mark:Mark={id:crypto.randomUUID(),page,x:Math.min(p.x,s.x),y:Math.min(p.y,s.y),w,h,kind:markType,text:options.text,size:options.size,color:options.color};patch({marks:[...(markType==='crop'?options.marks.filter(m=>m.kind!=='crop'):options.marks),mark]});};
  const execute=async()=>{
    if(active.current||!files.length)return;active.current=true;setBusy(true);setError('');setProgress(2);setStatus('Traitement sur votre appareil…');const current=generation.current,signal=abort.current.signal;
    const update=(n:number,message?:string)=>{if(current===generation.current){setProgress(n);if(message)setStatus(message);}};
    try {
      const job={tool:toolId,files,options};let output:ResultFile[];
      if(['protect','unlock','repair'].includes(toolId))output=await (await import('../tools/advanced-pdf')).securePdf(job,signal);
      else if(['ocr','redact','pdf-a'].includes(toolId))output=await (await import('../tools/raster')).rasterPdf(job,update,signal);
      else if(toolId==='scan')output=await (await import('../tools/raster')).scanPdf(job,update,signal);
      else if(toolId==='compare')output=await (await import('../tools/raster')).comparePdf(job,update,signal);
      else if(toolId==='word-pdf'||toolId==='html-pdf')output=await (await import('../tools/office')).htmlOrWordPdf(job,update,signal);
      else if(toolId==='ppt-pdf')output=await (await import('../tools/office')).presentationPdf(job,update,signal);
      else if(toolId==='excel-pdf')output=await (await import('../tools/office')).spreadsheetPdf(job,update,signal);
      else if(['pdf-word','pdf-ppt','pdf-excel'].includes(toolId))output=await (await import('../tools/office')).exportOffice(job,update,signal);
      else output=await (await import('../tools/advanced-pdf')).transformPdf(job,update,signal);
      if(current!==generation.current)return;
      const zip=output.length>1?await createArchive(output,signal):null;
      let preview:PDFDocumentProxy|null=null;
      if(output[0].mime==='application/pdf'&&toolId!=='protect')preview=await openPdf(output[0].bytes,signal);
      if(current!==generation.current){await preview?.loadingTask.destroy();return;}
      release();pdfRef.current=preview;setPdf(preview);setPage(0);setResults(output);setArchive(zip);setFiles([]);setStamp(null);patch({password:'',confirm:'',marks:[],fields:[]});setProgress(100);
    } catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Le traitement a échoué. Essayez un fichier plus petit.');}
    finally {if(current===generation.current){setBusy(false);active.current=false;}}
  };
  const marks=[...options.marks,...(draft?[draft]:[])].filter(m=>m.page===page);
  const preview=pdf && <div className="advanced-preview"><div className={`page-board ${visual&&!results.length?'drawing-board':''}`} onPointerDown={begin} onPointerMove={draw} onPointerUp={end} onPointerCancel={()=>{start.current=null;setDraft(null);}}><PdfCanvas pdf={pdf} index={page} onSize={setPageSize}/>{!results.length && marks.map(m=><span key={m.id} className={`page-mark mark-${m.kind}`} style={{left:m.x*100+'%',top:m.y*100+'%',width:m.w*100+'%',height:m.h*100+'%',color:m.color,fontSize:`${m.size/pageSize.width*100}cqw`}}>{m.kind==='image'&&m.image?<ImagePreview file={{bytes:m.image,name:'Élément ajouté'}}/>:m.kind==='text'?m.text:m.kind==='field'?m.text:m.kind==='checkbox'?'☐':null}</span>)}</div><div className="preview-pagination"><button className="icon-button" aria-label="Page précédente" disabled={page===0||busy} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={18}/></button><span>Page {page+1} sur {pdf.numPages}</span><button className="icon-button" aria-label="Page suivante" disabled={page===pdf.numPages-1||busy} onClick={()=>setPage(p=>p+1)}><ChevronRight size={18}/></button></div></div>;
  const rangeField=<label className="field">{toolId==='delete'?'Pages à supprimer':toolId==='extract'?'Pages à extraire':'Pages à traiter'}<input value={options.range} onChange={e=>patch({range:e.target.value})} placeholder="Ex. 1, 3-5"/><small>{toolId==='delete'||toolId==='extract'?'Indiquez au moins une page.':'Vide = toutes les pages.'}</small></label>;
  return <main className="workspace wrap"><a className="back-link" href="#/"><ArrowLeft size={16}/> Tous les outils</a><header className="workspace-heading"><span className={`tool-icon ${tool.color}`}><tool.icon size={28}/></span><h1>{tool.name}</h1><p>{tool.detail}</p></header><div className="local-notice"><ShieldCheck size={17}/><span>Traitement local : vos fichiers ne quittent pas votre appareil.</span><a href="#/confidentialite">En savoir plus <ArrowRight size={14}/></a></div>
    {notes[toolId]&&<details className="limits-note" open={['redact','sign','pdf-a','crop'].includes(toolId)}><summary><Info size={16}/> Ce que cet outil fait et ses limites</summary><p>{notes[toolId]}</p></details>}
    <input ref={input} type="file" className="sr-only" aria-label="Importer des fichiers" accept={formats[toolId]||'application/pdf,.pdf'} multiple={multiple} onChange={e=>void add(Array.from(e.target.files||[]))}/>
    <input ref={camera} type="file" className="sr-only" aria-label="Prendre une photo" accept="image/jpeg,image/png" capture="environment" onChange={e=>void add(Array.from(e.target.files||[]))}/>
    <input ref={stampInput} type="file" className="sr-only" aria-label="Importer une image à placer" accept="image/png,image/jpeg" onChange={e=>{const file=e.target.files?.[0];if(file)void (async()=>{try{validateFiles([file]);await chooseStamp(new Uint8Array(await file.arrayBuffer()));}catch(err){setError(err instanceof Error?err.message:'Image non prise en charge.');}finally{if(stampInput.current)stampInput.current.value='';}})();}}/>
    {error&&<div className="error-banner" role="alert"><Info size={18}/><span>{error}</span></div>}
    {loading&&<p className="loading-banner" role="status"><LoaderCircle className="spin" size={18}/> Ouverture locale de vos fichiers…</p>}
    {results.length?<><section className="result-panel"><div className="success-mark"><Check size={36}/></div><span className="section-kicker">VOTRE RÉSULTAT EST PRÊT</span><h2>Vérifiez, puis téléchargez.</h2><p>{toolId==='redact'?'Les pages ont été reconstruites sans les objets du document original.':toolId==='repair'?'La structure a été reconstruite. Vérifiez que toutes les pages sont lisibles.':'Tout a été traité sur votre appareil.'}</p><DownloadLink file={archive||results[0]} primary label={archive?'Télécharger le rapport et les données':'Télécharger le résultat'}/>{archive&&<div className="individual-downloads">{results.map(f=><DownloadLink file={f} key={f.name}/>)}</div>}<p className="hint">{notes[toolId]||'Conservez votre original et vérifiez le résultat.'}</p><button className="button secondary" onClick={reset}><Trash2 size={16}/> Supprimer mes fichiers / Recommencer</button></section>{preview&&<section className="result-preview"><h2>Aperçu du résultat</h2>{preview}</section>}</>:<>
      {!files.length&&<div className={`drop-zone ${drag?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);void add(Array.from(e.dataTransfer.files));}}><div className="drop-symbol"><FilePlus2 size={31}/><span><Plus size={13}/></span></div><h2>{toolId==='compare'?'Deux documents, les différences en vue.':toolId==='scan'?'Votre document, à portée de photo.':'Votre prochain document commence ici.'}</h2><p>Glissez-déposez {multiple?'vos fichiers':'votre fichier'} ici ou choisissez-le sur votre appareil.</p><button className="button primary" disabled={loading} onClick={()=>input.current?.click()}><Plus size={19}/> Sélectionner {multiple?'des fichiers':'un fichier'}</button>{toolId==='scan'&&<button className="button secondary" disabled={loading} onClick={()=>camera.current?.click()}><Camera size={18}/> Appareil photo</button>}<small>{formats[toolId]?.replaceAll('.','').toUpperCase()||'PDF'} · 25 Mo par fichier · 50 Mo au total</small><span className="drop-private"><LockKeyhole size={13}/> Aucun fichier envoyé sur un serveur</span></div>}
      {!!files.length&&<div className="editor-layout advanced-layout"><section className="document-panel"><div className="panel-heading"><div><h2>{visual?'Votre espace de travail':'Vos documents'}</h2><span>{files.length} fichier{files.length>1?'s':''} · {formatBytes(files.reduce((s,f)=>s+f.bytes.length,0))}</span></div>{multiple&&<button className="button small secondary" disabled={busy||loading} onClick={()=>input.current?.click()}><Plus size={16}/> Ajouter</button>}</div>
        {visual&&pdf&&<p className="canvas-tip">{['text','image'].includes(markType)?'Cliquez sur la page pour placer l’élément.':'Tracez un rectangle sur la page avec la souris ou le doigt.'} Utilisez « Annuler » pour retirer le dernier ajout.</p>}
        <div className="advanced-file-list">{files.map((f,i)=><div key={i} className="advanced-file">{toolId==='scan'&&<ImagePreview file={f}/>}<span>{f.name}</span>{multiple&&<div><button className="icon-button" aria-label={`Monter ${f.name}`} disabled={i===0||busy||loading} onClick={()=>setFiles(old=>{const next=[...old];[next[i-1],next[i]]=[next[i],next[i-1]];return next;})}><ArrowUp size={15}/></button><button className="icon-button" aria-label={`Descendre ${f.name}`} disabled={i===files.length-1||busy||loading} onClick={()=>setFiles(old=>{const next=[...old];[next[i+1],next[i]]=[next[i],next[i+1]];return next;})}><ArrowDown size={15}/></button><button className="icon-button" aria-label={`Retirer ${f.name}`} disabled={busy||loading} onClick={()=>{if(files.length===1)reset();else setFiles(old=>old.filter((_,j)=>i!==j));}}><Trash2 size={15}/></button></div>}</div>)}</div>
        {preview}
        {visual&&!!options.marks.length&&<div className="mark-list"><h3>{options.marks.length} élément{options.marks.length>1?'s':''} ajouté{options.marks.length>1?'s':''}</h3>{options.marks.map((m,i)=><div key={m.id}><button className="text-button" disabled={busy} onClick={()=>setPage(m.page)}>Page {m.page+1} · {m.kind==='redact'?'Zone censurée':m.kind==='crop'?'Zone à conserver':m.kind==='image'?'Image / signature':m.text.slice(0,32)}</button><button className="icon-button" disabled={busy} aria-label={`Retirer l’élément ${i+1}`} onClick={()=>patch({marks:options.marks.filter(v=>v.id!==m.id)})}><Trash2 size={15}/></button></div>)}</div>}
        {!pdf&&<div className="local-file-placeholder"><tool.icon size={56}/><p>{isOffice?'L’aperçu du PDF sera disponible après la conversion.':toolId==='scan'?'Vos photos seront assemblées dans cet ordre.':'Votre fichier est prêt pour le traitement local.'}</p></div>}
      </section><aside className="settings-panel"><h2>À votre façon.</h2><p className="settings-sub">Réglez votre outil, puis vérifiez le résultat.</p><fieldset className="settings-fields" disabled={busy||loading}>
        {['delete','extract','numbers','watermark','ocr','pdf-word','pdf-excel','pdf-ppt'].includes(toolId)&&rangeField}
        {(toolId==='protect'||toolId==='unlock')&&<><label className="field">{toolId==='protect'?'Nouveau mot de passe':'Mot de passe du PDF'}<input type="password" autoComplete="off" spellCheck={false} value={options.password} onChange={e=>patch({password:e.target.value})}/><small>{toolId==='protect'?'8 caractères minimum.':''} Jamais envoyé ni enregistré.</small></label>{toolId==='protect'&&<label className="field">Confirmer le mot de passe<input type="password" autoComplete="off" value={options.confirm} onChange={e=>patch({confirm:e.target.value})}/></label>}</>}
        {toolId==='ocr'&&<label className="field">Langue du document<select value={options.language} onChange={e=>patch({language:e.target.value})}><option value="fra">Français</option><option value="eng">Anglais</option><option value="fra+eng">Français et anglais</option></select></label>}
        {['pdf-a','pdf-ppt','redact'].includes(toolId)&&<label className="field">Résolution<select value={options.scale} onChange={e=>patch({scale:Number(e.target.value)})}><option value={1}>Standard · 72 ppp</option><option value={1.5}>Équilibrée · 108 ppp</option><option value={2}>Élevée · 144 ppp</option></select></label>}
        {toolId==='numbers'&&<><label className="field">Premier numéro<input type="number" min={0} max={999999} value={options.start} onChange={e=>patch({start:Math.max(0,Number(e.target.value))})}/></label><label className="field">Position<select value={options.position} onChange={e=>patch({position:e.target.value})}>{[['bottom-left','En bas à gauche'],['bottom-center','En bas au centre'],['bottom-right','En bas à droite'],['top-left','En haut à gauche'],['top-center','En haut au centre'],['top-right','En haut à droite']].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label></>}
        {toolId==='edit'&&<label className="field">Élément à ajouter<select value={markType} onChange={e=>setMarkType(e.target.value as Mark['kind'])}><option value="text">Texte</option><option value="image">Image</option></select></label>}
        {toolId==='forms'&&<><h3>Champs existants</h3>{!options.fields.length&&<p className="hint">Aucun champ AcroForm détecté. Vous pouvez en créer sur la page.</p>}{options.fields.map((f,i)=><label className="field" key={f.name}>{f.name}{f.readOnly||f.type==='unsupported'?<small>Champ en lecture seule ou non pris en charge</small>:f.type==='check'?<input type="checkbox" checked={f.value==='true'} onChange={e=>patch({fields:options.fields.map((v,j)=>j===i?{...v,value:String(e.target.checked)}:v)})}/>:f.type==='select'?<select value={f.value} onChange={e=>patch({fields:options.fields.map((v,j)=>j===i?{...v,value:e.target.value}:v)})}><option value="">— Choisir —</option>{f.options?.map(v=><option key={v}>{v}</option>)}</select>:<input value={f.value} onChange={e=>patch({fields:options.fields.map((v,j)=>j===i?{...v,value:e.target.value}:v)})}/>}</label>)}<label className="field">Nouveau champ<select value={markType} onChange={e=>setMarkType(e.target.value as Mark['kind'])}><option value="field">Champ de texte</option><option value="checkbox">Case à cocher</option></select></label><label className="field">Nom unique du champ<input value={options.text} onChange={e=>patch({text:e.target.value})}/></label><label className="check-field"><input type="checkbox" checked={options.flatten} onChange={e=>patch({flatten:e.target.checked})}/> Figer les réponses (retirer les champs interactifs)</label></>}
        {(toolId==='watermark'||(toolId==='edit'&&markType==='text'))&&<label className="field">Texte à ajouter<input maxLength={160} value={options.text} onChange={e=>patch({text:e.target.value})}/></label>}
        {['numbers','watermark','edit'].includes(toolId)&&<><label className="field">Taille du texte<input type="number" min={6} max={120} value={options.size} onChange={e=>patch({size:Math.min(120,Math.max(6,Number(e.target.value)))})}/></label><label className="field">Couleur<input type="color" value={options.color} onChange={e=>patch({color:e.target.value})}/></label></>}
        {toolId==='watermark'&&<label className="field">Opacité · {Math.round(options.opacity*100)} %<input type="range" min={.05} max={1} step={.05} value={options.opacity} onChange={e=>patch({opacity:Number(e.target.value)})}/></label>}
        {toolId==='crop'&&<><label className="check-field"><input type="checkbox" checked={options.allPages} onChange={e=>patch({allPages:e.target.checked})}/> Appliquer cette zone à plusieurs pages</label>{options.allPages&&rangeField}</>}
        {(toolId==='sign'||toolId==='edit'&&markType==='image')&&<>{toolId==='sign'&&<SignaturePad onSave={bytes=>void chooseStamp(bytes).catch(e=>setError(e.message))}/>}<button className="button secondary" onClick={()=>stampInput.current?.click()}><Upload size={16}/> Importer {toolId==='sign'?'une signature':'une image'}</button>{stamp&&<p className="hint">Image prête. Cliquez sur la page pour la placer.</p>}</>}
        {toolId==='scan'&&<><label className="field">Filtre<select value={options.scanMode} onChange={e=>patch({scanMode:e.target.value})}><option value="color">Couleur</option><option value="gray">Niveaux de gris</option><option value="bw">Noir et blanc contrasté</option></select></label><label className="field">Rotation<select value={options.scanRotation} onChange={e=>patch({scanRotation:Number(e.target.value)})}>{[0,90,180,270].map(v=><option key={v} value={v}>{v}°</option>)}</select></label><label className="field">Rogner les bords · {options.scanMargin} %<input type="range" min={0} max={30} value={options.scanMargin} onChange={e=>patch({scanMargin:Number(e.target.value)})}/></label><button className="button secondary" onClick={()=>camera.current?.click()}><Camera size={16}/> Ajouter une photo</button></>}
        {toolId==='compare'&&<label className="field">Tolérance aux différences<select value={options.threshold} onChange={e=>patch({threshold:Number(e.target.value)})}><option value={10}>Faible · détails fins</option><option value={25}>Moyenne</option><option value={60}>Élevée · différences marquées</option></select><small>Les petits écarts de rendu peuvent être ignorés.</small></label>}
        {visual&&<button className="button secondary" disabled={!options.marks.length} onClick={()=>patch({marks:options.marks.slice(0,-1)})}><Undo2 size={16}/> Annuler le dernier ajout</button>}
      </fieldset>
      {busy?<div className="progress-block" role="status"><div><LoaderCircle className="spin" size={18}/><strong>{status}</strong><span>{progress} %</span></div><progress value={progress} max={100}/><button className="button secondary full" onClick={reset}>Annuler et supprimer les fichiers</button></div>:<button className="button primary full execute-button" disabled={loading||(toolId==='compare'&&files.length!==2)} onClick={()=>void execute()}>{tool.action}<ArrowRight size={18}/></button>}
      <div className="settings-lock"><LockKeyhole size={14}/> Toujours sur votre appareil</div></aside></div>}
      {!!files.length&&!busy&&<div className="reset-row"><button className="text-button" onClick={reset}><Trash2 size={15}/> Supprimer mes fichiers / Recommencer</button><span>Aucune copie conservée par l’application</span></div>}
      <div className="tool-bottom-notes"><article><ShieldCheck/><div><h3>Votre appareil fait le travail.</h3><p>Les fichiers restent en mémoire dans cet onglet. Les moteurs sont chargés depuis ce site.</p></div></article><article><Info/><div><h3>Gardez votre original.</h3><p>150 pages maximum. Une modification peut invalider une signature numérique. Vérifiez le résultat avant de le partager.</p></div></article></div>
    </>}
  </main>;
}


