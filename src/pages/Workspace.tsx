import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Check, CheckCircle2, ChevronLeft, ChevronRight, FilePlus2, FileText, GripVertical, ImagePlus, Info, LoaderCircle, LockKeyhole, Plus, RotateCw, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { getTool } from '../lib/tools';
import { MAX_FILES, MAX_OUTPUT_BYTES, MAX_PAGES, formatBytes, sniffFile, userError, validateFiles, validateImageDimensions } from '../lib/limits';
import { parseGroups, parsePages } from '../lib/ranges';
import { canvasBytes, openPdf, renderPage } from '../lib/pdf-render';
import { createArchive } from '../lib/archive';
import { usePdfWorker } from '../hooks/usePdfWorker';
import { Thumbnail } from '../components/Thumbnail';
import { ImageThumbnail } from '../components/ImageThumbnail';
import { DownloadLink } from '../components/Download';
import type { FileSource, PageRef, ResultFile, ToolId } from '../types';

export function Workspace({ toolId }: { toolId: ToolId }) {
  const tool = getTool(toolId);
  const inputRef = useRef<HTMLInputElement>(null);
  const pdfs = useRef(new Map<string, PDFDocumentProxy>());
  const generation = useRef(0);
  const abortRef = useRef(new AbortController());
  const activeRef = useRef(false);
  const [sources, setSources] = useState<FileSource[]>([]);
  const [pages, setPages] = useState<PageRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ResultFile[]>([]);
  const [archive, setArchive] = useState<ResultFile | null>(null);
  const [beforeSize, setBeforeSize] = useState(0);
  const [range, setRange] = useState('');
  const [splitMode, setSplitMode] = useState('extract');
  const [angle, setAngle] = useState(90);
  const [pageSize, setPageSize] = useState<'a4' | 'letter' | 'fit'>('a4');
  const [landscape, setLandscape] = useState(false);
  const [margin, setMargin] = useState(20);
  const [imageFormat, setImageFormat] = useState<'image/png' | 'image/jpeg'>('image/png');
  const [scale, setScale] = useState(1.5);
  const [previewIndex, setPreviewIndex] = useState(0);
  const dragItem = useRef<number | null>(null);
  const { run, cancel } = usePdfWorker();
  const isImages = toolId === 'images-pdf';
  const isMultiple = toolId === 'merge' || toolId === 'organize' || isImages;
  const isFileList = toolId === 'merge' || isImages;
  const totalBytes = sources.reduce((sum, source) => sum + source.bytes.length, 0);
  const totalPages = sources.reduce((sum, source) => sum + source.pageCount, 0);
  const first = sources[0];
  const hasResults = results.length > 0;

  const disposeDocuments = () => {
    for (const pdf of pdfs.current.values()) void pdf.loadingTask.destroy();
    pdfs.current.clear();
  };
  const reset = () => {
    generation.current++;
    abortRef.current.abort();
    abortRef.current = new AbortController();
    cancel();
    activeRef.current = false;
    disposeDocuments();
    setSources([]); setPages([]); setResults([]); setArchive(null); setError(''); setNotice(''); setRange(''); setLoading(false); setBusy(false); setProgress(0); setPreviewIndex(0);
    if (inputRef.current) inputRef.current.value = '';
  };
  useEffect(() => {
    const leave = () => { generation.current++; abortRef.current.abort(); cancel(); disposeDocuments(); };
    const pageHide = () => { reset(); };
    window.addEventListener('pagehide', pageHide);
    return () => { window.removeEventListener('pagehide', pageHide); leave(); };
  }, []);

  const addFiles = async (incoming: File[]) => {
    if (activeRef.current || !incoming.length) return;
    activeRef.current = true;
    setError(''); setNotice('');
    const current = generation.current;
    const temporaryDocs = new Map<string, PDFDocumentProxy>();
    try {
      if (!isMultiple && incoming.length > 1) throw new Error('Cet outil traite un seul PDF à la fois.');
      const existing = isMultiple ? sources : [];
      validateFiles(incoming, existing.reduce((sum, file) => sum + file.bytes.length, 0), existing.length);
      setLoading(true);
      const added: FileSource[] = [];
      let count = existing.reduce((sum, file) => sum + file.pageCount, 0);
      for (const file of incoming) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (current !== generation.current) return;
        const kind = sniffFile(bytes);
        if (!kind || (isImages ? kind === 'pdf' : kind !== 'pdf')) throw new Error(isImages ? 'Choisissez uniquement des images JPG ou PNG valides.' : 'Choisissez uniquement des fichiers PDF valides.');
        const id = crypto.randomUUID();
        let pageCount = 1;
        if (kind === 'pdf') {
          const pdf = await openPdf(bytes, abortRef.current.signal);
          if (current !== generation.current) { await pdf.loadingTask.destroy(); return; }
          temporaryDocs.set(id, pdf);
          // PDF.js may open encrypted PDFs with empty user passwords. Reject them too.
          if (await pdf.getPermissions() !== null) throw new Error('Les PDF chiffrés ne sont pas pris en charge dans cette version.');
          pageCount = pdf.numPages;
        } else {
          validateImageDimensions(bytes, kind);
          // Decode once to reject malformed images and avoid oversized pixel allocations later.
          const image = await createImageBitmap(new Blob([bytes], { type: kind === 'png' ? 'image/png' : 'image/jpeg' }));
          const pixels = image.width * image.height;
          image.close();
          if (pixels > 40_000_000) throw new Error('Une image dépasse 40 mégapixels. Réduisez sa taille avant de l’ajouter.');
        }
        count += pageCount;
        if (count > MAX_PAGES) throw new Error('Limite de 150 pages par opération. Ajoutez moins de documents.');
        added.push({ id, name: file.name, bytes, kind, pageCount });
      }
      if (current !== generation.current) return;
      if (!isMultiple) disposeDocuments();
      for (const [id, pdf] of temporaryDocs) pdfs.current.set(id, pdf);
      temporaryDocs.clear();
      setSources([...existing, ...added]);
      const addedPages = added.flatMap(source => Array.from({ length: source.pageCount }, (_, index) => ({ id: crypto.randomUUID(), sourceId: source.id, index, rotation: 0 })));
      setPages(previous => isMultiple ? [...previous, ...addedPages] : addedPages);
      setPreviewIndex(0);
    } catch (err) { if (current === generation.current) setError(userError(err)); }
    finally {
      for (const pdf of temporaryDocs.values()) void pdf.loadingTask.destroy();
      if (current === generation.current) { setLoading(false); activeRef.current = false; }
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const move = (from: number, to: number, type: 'sources' | 'pages') => {
    if (to < 0) return;
    if (type === 'sources') setSources(previous => { if (to >= previous.length) return previous; const next = [...previous]; next.splice(to, 0, next.splice(from, 1)[0]); return next; });
    else setPages(previous => { if (to >= previous.length) return previous; const next = [...previous]; next.splice(to, 0, next.splice(from, 1)[0]); return next; });
  };
  const removeSource = (id: string) => {
    void pdfs.current.get(id)?.loadingTask.destroy(); pdfs.current.delete(id);
    setSources(previous => previous.filter(source => source.id !== id));
    setPages(previous => previous.filter(page => page.sourceId !== id));
  };
  const execute = async () => {
    if (activeRef.current || !sources.length) return;
    activeRef.current = true;
    setError(''); setBusy(true); setProgress(3);
    const current = generation.current;
    const signal = abortRef.current.signal;
    try {
      const selection = ['rotate', 'pdf-images'].includes(toolId) ? parsePages(range, first.pageCount) : [];
      let groups: number[][] = [];
      if (toolId === 'split') groups = splitMode === 'all' ? Array.from({ length: first.pageCount }, (_, index) => [index]) : splitMode === 'groups' ? parseGroups(range, first.pageCount) : [parsePages(range, first.pageCount)];
      let output: ResultFile[];
      if (toolId === 'pdf-images') {
        output = [];
        const pdf = pdfs.current.get(first.id)!;
        const canvas = document.createElement('canvas');
        let bytesTotal = 0;
        try {
          for (let i = 0; i < selection.length; i++) {
            await renderPage(pdf, selection[i], canvas, scale, undefined, signal);
            if (signal.aborted) throw new Error('Opération annulée.');
            const bytes = await canvasBytes(canvas, imageFormat);
            bytesTotal += bytes.length;
            if (bytesTotal > MAX_OUTPUT_BYTES) throw new Error('Les images dépassent 100 Mo. Réduisez la résolution ou le nombre de pages.');
            output.push({ name: `levisa-page-${String(selection[i] + 1).padStart(3, '0')}.${imageFormat === 'image/png' ? 'png' : 'jpg'}`, bytes, mime: imageFormat });
            setProgress(5 + Math.round((i + 1) / selection.length * 80));
          }
        } finally { canvas.width = 0; canvas.height = 0; }
      } else {
        output = await run({ tool: toolId, sources, pages, selection, groups, angle, pageSize, landscape, margin }, value => { if (current === generation.current) setProgress(value); });
      }
      if (current !== generation.current) return;
      setProgress(95);
      const zipped = output.length > 1 ? await createArchive(output, signal) : null;
      if (current !== generation.current) return;
      setBeforeSize(totalBytes); setResults(output); setArchive(zipped); setProgress(100);
      // Inputs, PDF.js workers, thumbnails and page references are no longer needed.
      disposeDocuments(); setSources([]); setPages([]);
    } catch (err) { if (current === generation.current) setError(userError(err)); }
    finally { if (current === generation.current) { setBusy(false); activeRef.current = false; } }
  };

  const dropArea = <div className={`drop-zone ${dragging ? 'dragging' : ''} ${sources.length ? 'compact' : ''}`} onDragOver={e => { e.preventDefault(); if (!busy && !loading) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void addFiles(Array.from(e.dataTransfer.files)); }}>
    <div className="drop-symbol">{isImages ? <ImagePlus size={31} /> : <FilePlus2 size={31} />}<span><Plus size={13} /></span></div>
    <h2>{sources.length ? 'Ajouter d’autres fichiers' : isImages ? 'Vos images, un nouveau PDF.' : 'Votre prochain PDF commence ici.'}</h2>
    <p>Glissez-déposez {isImages ? 'vos images' : isMultiple ? 'vos PDF' : 'votre PDF'} ici ou choisissez-les sur votre appareil.</p>
    <button className="button primary" onClick={() => inputRef.current?.click()} disabled={busy || loading}><Plus size={19} />{sources.length ? 'Ajouter des fichiers' : isImages ? 'Sélectionner des images' : isMultiple ? 'Sélectionner des PDF' : 'Sélectionner un PDF'}</button>
    <small>{isImages ? 'JPG, PNG' : 'Fichiers PDF'} · 25 Mo par fichier · 50 Mo au total</small>
    <span className="drop-private"><LockKeyhole size={13} /> Aucun fichier envoyé sur un serveur</span>
  </div>;

  return <main className="workspace wrap">
    <a className="back-link" href="#/"><ArrowLeft size={16} /> Tous les outils</a>
    <header className="workspace-heading"><span className={`tool-icon ${tool.color}`}><tool.icon size={28} /></span><h1>{tool.name}</h1><p>{tool.detail}</p></header>
    <div className="local-notice"><ShieldCheck size={17} /><span>Traitement local : vos fichiers ne quittent pas votre appareil.</span><a href="#/confidentialite">En savoir plus <ArrowRight size={14} /></a></div>
    <input ref={inputRef} type="file" accept={isImages ? 'image/jpeg,image/png,.jpg,.jpeg,.png' : 'application/pdf,.pdf'} multiple={isMultiple} className="sr-only" aria-label={isImages ? 'Importer des images' : 'Importer des PDF'} onChange={e => void addFiles(Array.from(e.target.files || []))} disabled={busy || loading} />
    {error && <div className="error-banner" role="alert"><Info size={19} /><span>{error}</span><button className="icon-button" aria-label="Fermer le message" onClick={() => setError('')}><X size={17} /></button></div>}
    {notice && <p className="status-text" role="status">{notice}</p>}
    {loading && <div className="loading-banner" role="status"><LoaderCircle className="spin" size={20} /><span>Ouverture et vérification de vos fichiers, sur votre appareil…</span><button onClick={reset}>Annuler</button></div>}
    {hasResults ? <section className="result-panel"><div className="success-mark"><Check size={36} /></div><span className="section-kicker">ET VOILÀ, C’EST PRÊT</span><h2>{toolId === 'compress' && results[0].bytes.length >= beforeSize ? 'Votre PDF est déjà bien optimisé.' : 'Votre document, comme vous le vouliez.'}</h2><p>{results.length > 1 ? `${results.length} fichiers prêts à être téléchargés.` : 'Votre fichier est prêt à être téléchargé.'} Tout a été traité sur votre appareil.</p>{toolId === 'compress' && <div className="compression-stats"><div><small>Avant</small><strong>{formatBytes(beforeSize)}</strong></div><ArrowRight /><div><small>Après</small><strong>{formatBytes(results[0].bytes.length)}</strong></div><span>{Math.round((1 - results[0].bytes.length / beforeSize) * 100)} % de réduction</span></div>}{toolId === 'compress' && results[0].bytes.length >= beforeSize && <p className="compression-note">Aucun gain obtenu sans perte : le fichier original est conservé.</p>}<DownloadLink file={archive || results[0]} primary label={archive ? 'Tout télécharger en ZIP' : 'Télécharger le résultat'} />{results.length > 1 && <details className="individual-downloads"><summary>Télécharger les {results.length} fichiers séparément</summary><div>{results.map(file => <DownloadLink file={file} key={file.name} />)}</div></details>}<p className="result-clean"><CheckCircle2 size={15} /> Les fichiers sources ont été libérés. Le résultat reste ici jusqu’à votre réinitialisation.</p><button className="button secondary" onClick={reset}><Trash2 size={17} /> Supprimer mes fichiers / Recommencer</button></section> : <>
      {!sources.length && dropArea}
      {!!sources.length && <div className="editor-layout"><section className="document-panel"><div className="panel-heading"><div><h2>{toolId === 'organize' ? 'Vos pages' : isFileList ? 'Vos fichiers' : 'Aperçu du document'}</h2><span>{sources.length} fichier{sources.length > 1 ? 's' : ''} · {toolId === 'organize' ? pages.length : totalPages} page{totalPages > 1 ? 's' : ''} · {formatBytes(totalBytes)}</span></div>{isMultiple && <button className="button small secondary" onClick={() => inputRef.current?.click()} disabled={busy || loading}><Plus size={16} /> Ajouter</button>}</div>
      <fieldset disabled={busy || loading} className="editor-fieldset">
      {isFileList ? <><p className="list-tip"><GripVertical size={15} /> Glissez pour réordonner, ou utilisez les flèches.</p><div className="file-list">{sources.map((source, i) => <article key={source.id} className="file-row" draggable={!busy} onDragStart={e => { dragItem.current = i; e.dataTransfer.effectAllowed = 'move'; }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragItem.current !== null) move(dragItem.current, i, 'sources'); dragItem.current = null; }}><GripVertical className="drag-handle" size={18} /><div className="file-preview">{isImages ? <ImageThumbnail source={source} /> : <Thumbnail pdf={pdfs.current.get(source.id)} index={0} />}</div><div className="file-info"><strong title={source.name}>{source.name}</strong><small>{source.pageCount} page{source.pageCount > 1 ? 's' : ''} · {formatBytes(source.bytes.length)}</small></div><div className="row-actions"><button className="icon-button" aria-label={`Monter ${source.name}`} onClick={() => move(i, i - 1, 'sources')} disabled={i === 0}><ArrowUp size={16} /></button><button className="icon-button" aria-label={`Descendre ${source.name}`} onClick={() => move(i, i + 1, 'sources')} disabled={i === sources.length - 1}><ArrowDown size={16} /></button><button className="icon-button delete" aria-label={`Retirer ${source.name}`} onClick={() => removeSource(source.id)}><X size={17} /></button></div></article>)}</div></> : toolId === 'organize' ? <><p className="list-tip"><GripVertical size={15} /> Glissez les pages pour les réorganiser.</p><div className="pages-grid">{pages.map((page, i) => <article className="page-tile" key={page.id} draggable={!busy} onDragStart={e => { dragItem.current = i; e.dataTransfer.effectAllowed = 'move'; }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragItem.current !== null) move(dragItem.current, i, 'pages'); dragItem.current = null; }}><div className="page-preview"><Thumbnail pdf={pdfs.current.get(page.sourceId)} index={page.index} rotation={page.rotation} /><span className="page-position">{i + 1}</span></div><span className="page-origin" title={sources.find(source => source.id === page.sourceId)?.name}>Page {page.index + 1} · {sources.find(source => source.id === page.sourceId)?.name}</span><div className="page-actions"><button className="icon-button" aria-label={`Déplacer la page ${i + 1} avant`} onClick={() => move(i, i - 1, 'pages')} disabled={i === 0}><ChevronLeft size={15} /></button><button className="icon-button" aria-label={`Pivoter la page ${i + 1}`} onClick={() => setPages(previous => previous.map(p => p.id === page.id ? { ...p, rotation: (p.rotation + 90) % 360 } : p))}><RotateCw size={15} /></button><button className="icon-button delete" aria-label={`Supprimer la page ${i + 1}`} onClick={() => setPages(previous => previous.filter(p => p.id !== page.id))}><Trash2 size={14} /></button><button className="icon-button" aria-label={`Déplacer la page ${i + 1} après`} onClick={() => move(i, i + 1, 'pages')} disabled={i === pages.length - 1}><ChevronRight size={15} /></button></div></article>)}</div>{!pages.length && <p className="empty-pages">Toutes les pages ont été retirées. Ajoutez un PDF pour continuer.</p>}</> : <div className="single-preview"><div className="preview-paper"><Thumbnail key={previewIndex} pdf={pdfs.current.get(first.id)} index={previewIndex} /></div><div className="preview-pagination"><button className="icon-button" aria-label="Page précédente" disabled={previewIndex === 0} onClick={() => setPreviewIndex(i => i - 1)}><ChevronLeft size={17} /></button><span>Page {previewIndex + 1} sur {first.pageCount}</span><button className="icon-button" aria-label="Page suivante" disabled={previewIndex === first.pageCount - 1} onClick={() => setPreviewIndex(i => i + 1)}><ChevronRight size={17} /></button></div><div className="preview-name"><FileText size={15} />{first.name}</div></div>}
      </fieldset></section>
      <aside className="settings-panel"><h2>À votre façon.</h2><p className="settings-sub">Quelques réglages, et c’est prêt.</p><fieldset disabled={busy || loading} className="settings-fields">
      {toolId === 'merge' && <div className="setting-info"><CombineIcon /><strong>Un document, votre ordre.</strong><p>Les fichiers seront assemblés dans l’ordre affiché. Vous pouvez les déplacer avec les flèches.</p></div>}
      {toolId === 'split' && <><label className="field">Mode d’extraction<select value={splitMode} onChange={e => { setSplitMode(e.target.value); setRange(''); }}><option value="extract">Un PDF avec les pages choisies</option><option value="groups">Un PDF par groupe de pages</option><option value="all">Un PDF par page</option></select></label>{splitMode !== 'all' && <label className="field">{splitMode === 'groups' ? 'Groupes de pages' : 'Pages à extraire'}<input value={range} onChange={e => setRange(e.target.value)} placeholder={splitMode === 'groups' ? '1-3 ; 4-6' : 'Ex. 1, 3-5'} /><small>{splitMode === 'groups' ? 'Séparez chaque futur PDF par un point-virgule.' : 'Laissez vide pour conserver toutes les pages.'}</small></label>}{splitMode !== 'extract' && <p className="hint"><Info size={15} /> Vos PDF seront aussi réunis dans une archive ZIP.</p>}</>}
      {toolId === 'organize' && <div className="setting-info"><FileText size={30} /><strong>{pages.length} pages dans votre PDF</strong><p>Déplacez et faites pivoter les miniatures. Le bouton « Ajouter » permet d’insérer les pages d’un autre PDF.</p></div>}
      {toolId === 'rotate' && <><label className="field">Pages à faire pivoter<input value={range} onChange={e => setRange(e.target.value)} placeholder="Toutes les pages" /><small>Exemple : 1, 3-5. Vide = toutes les pages.</small></label><div className="field"><span>Rotation vers la droite</span><div className="segmented">{[90, 180, 270].map(value => <button key={value} className={angle === value ? 'selected' : ''} onClick={() => setAngle(value)} aria-pressed={angle === value}>{value}°</button>)}</div></div></>}
      {isImages && <><label className="field">Format des pages<select value={pageSize} onChange={e => setPageSize(e.target.value as typeof pageSize)}><option value="a4">A4 (21 × 29,7 cm)</option><option value="letter">Letter (US)</option><option value="fit">Ajuster à chaque image</option></select></label>{pageSize !== 'fit' && <label className="field">Orientation<select value={landscape ? 'landscape' : 'portrait'} onChange={e => setLandscape(e.target.value === 'landscape')}><option value="portrait">Portrait</option><option value="landscape">Paysage</option></select></label>}<label className="field">Marges<select value={margin} onChange={e => setMargin(Number(e.target.value))}><option value="0">Sans marge</option><option value="20">Petites (7 mm)</option><option value="40">Larges (14 mm)</option></select></label><p className="hint">Une image par page, sans déformation.</p></>}
      {toolId === 'pdf-images' && <><label className="field">Pages à convertir<input value={range} onChange={e => setRange(e.target.value)} placeholder="Toutes les pages" /><small>Exemple : 1, 3-5. Vide = toutes les pages.</small></label><label className="field">Format d’image<select value={imageFormat} onChange={e => setImageFormat(e.target.value as typeof imageFormat)}><option value="image/png">PNG · sans perte</option><option value="image/jpeg">JPG · plus léger</option></select></label><label className="field">Résolution<select value={scale} onChange={e => setScale(Number(e.target.value))}><option value="1">Standard · 72 ppp</option><option value="1.5">Équilibrée · 108 ppp</option><option value="2">Élevée · 144 ppp</option></select></label><p className="hint">Jusqu’à 12 mégapixels par page. Les images multiples sont regroupées en ZIP.</p></>}
      {toolId === 'compress' && <div className="setting-info"><ShieldCheck size={30} /><strong>Optimisation sans perte</strong><p>Réécriture de la structure interne. Les images et le texte ne sont pas dégradés.</p><p>Le gain n’est pas garanti : un PDF déjà optimisé peut garder la même taille. Dans ce cas, l’original est conservé.</p></div>}
      </fieldset>
      {busy ? <div className="progress-block" role="status"><div><LoaderCircle className="spin" size={17} /><strong>{progress < 95 ? 'Traitement local…' : 'Préparation du téléchargement…'}</strong><span>{progress} %</span></div><progress max="100" value={progress} aria-label="Progression du traitement" /><button className="button secondary full" onClick={reset}>Annuler et supprimer les fichiers</button></div> : <button className="button primary full execute-button" onClick={() => void execute()} disabled={loading || (toolId === 'merge' && sources.length < 2) || (toolId === 'organize' && !pages.length)}>{tool.action}<ArrowRight size={18} /></button>}
      {toolId === 'merge' && sources.length < 2 && <p className="hint">Ajoutez un deuxième PDF pour les fusionner.</p>}
      <div className="settings-lock"><LockKeyhole size={14} /> Toujours sur votre appareil</div></aside></div>}
      {!!sources.length && !busy && <div className="reset-row"><button className="text-button" onClick={reset}><Trash2 size={15} /> Supprimer mes fichiers / Recommencer</button><span>Aucune copie conservée par l’application</span></div>}
      <div className="tool-bottom-notes"><article><ShieldCheck /><div><h3>Votre appareil fait le travail.</h3><p>Vos documents restent en mémoire dans cet onglet. Aucun envoi vers un serveur.</p></div></article><article><Info /><div><h3>Bon à savoir</h3><p>150 pages et {MAX_FILES} fichiers maximum. PDF chiffrés non pris en charge. Une modification peut invalider une signature numérique et altérer formulaires ou signets.</p></div></article></div>
    </>}
  </main>;
}

function CombineIcon() { return <Upload size={30} />; }
