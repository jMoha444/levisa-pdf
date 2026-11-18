import { useState } from 'react';
import { ArrowRight, Search, ShieldCheck, LockKeyhole, Download, Sparkles, ArrowUpRight, FileText, Plus, Combine, RotateCw, Scissors, X } from 'lucide-react';
import { categories, tools } from '../lib/tools';
import type { Category } from '../types';

export function Home({ onInstall }: { onInstall: () => void }) {
  const [category, setCategory] = useState<Category>('Tous les outils');
  const [query, setQuery] = useState('');
  const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visible = tools.filter(tool => (category === 'Tous les outils' || category === tool.category) && normalized(tool.name + ' ' + tool.description).includes(normalized(query)));
  return <>
    <section className="hero wrap">
      <div className="hero-copy">
        <div className="eyebrow"><span className="status-dot" /> VOS DOCUMENTS, EN TOUTE CONFIDENTIALITÉ</div>
        <h1>Vos PDF. Vos outils.<br /><span>Vos données restent<br className="desktop-break" /> chez vous.</span></h1>
        <p>Tous les outils PDF dont vous avez besoin,<br className="wide-break" /> sans envoyer vos fichiers sur un serveur.</p>
        <div className="hero-actions"><a className="button primary" href="#outils" onClick={e => { e.preventDefault(); document.getElementById('outils')?.scrollIntoView({ behavior: 'smooth' }); }}>Découvrir les outils <ArrowRight size={18} /></a><a className="text-link" href="#/confidentialite"><ShieldCheck size={18} /> La confidentialité, d’abord</a></div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <span className="art-spark spark-one">✦</span><span className="art-spark spark-two">+</span>
        <div className="float-tool float-scissors"><Scissors /></div><div className="float-tool float-rotate"><RotateCw /></div>
        <div className="paper paper-back"><div className="paper-corner" /><span className="paper-line" /><span className="paper-line short" /></div>
        <div className="paper paper-front"><div className="paper-top"><div className="pdf-icon"><FileText size={27} /></div><span>PDF</span><i>•••</i></div><div className="paper-line w70" /><div className="paper-line w95" /><div className="paper-line w85" /><div className="paper-image"><div /><svg viewBox="0 0 190 60"><path d="M0 60L48 15L82 45L120 5L190 60Z" fill="currentColor" /></svg></div><div className="paper-line w95" /><div className="paper-line w70" /><div className="paper-footer"><span /> <b>01</b></div></div>
        <div className="security-chip"><span><ShieldCheck size={24} /></span><div><strong>Vos fichiers restent ici.</strong><small>Sur votre appareil. Uniquement.</small></div><span className="chip-dot" /></div>
        <div className="art-caption"><LockKeyhole size={12} /> Aucun fichier envoyé</div>
      </div>
    </section>
    <div className="trust-ribbon"><div className="wrap"><span><LockKeyhole /> Traitement sur votre appareil</span><i /><span><ShieldCheck /> Aucune collecte de documents</span><i /><span><Download /> Disponible hors ligne après installation</span></div></div>
    <section className="tools-section wrap" id="outils">
      <div className="section-top"><div><div className="section-kicker">VOTRE BOÎTE À OUTILS</div><h2>Un outil pour chaque PDF.</h2><p>Choisissez ce que vous souhaitez faire. On s’occupe du reste, ici.</p></div><label className="search-box"><Search size={18} /><input type="search" placeholder="Rechercher un outil…" aria-label="Rechercher un outil" value={query} onChange={e => setQuery(e.target.value)} /><kbd>⌕</kbd></label></div>
      <div className="tool-filters" role="group" aria-label="Catégories d’outils">{categories.map(name => <button className={name === category ? 'active' : ''} key={name} onClick={() => setCategory(name)}>{name}<span>{name === 'Tous les outils' ? tools.length : tools.filter(t => t.category === name).length}</span></button>)}</div>
      <div className="tool-grid">{visible.map(tool => <a key={tool.id} href={`#/outil/${tool.id}`} className={`tool-card ${tool.color}`}><div className="card-top"><span className="tool-icon"><tool.icon size={25} strokeWidth={1.75} /></span>{'badge' in tool && <span className="card-badge">{tool.badge}</span>}<ArrowUpRight className="card-arrow" size={20} /></div><h3>{tool.name}</h3><p>{tool.description}</p><div className="card-foot"><span><LockKeyhole size={11} /> Traitement local</span><ArrowRight size={16} /></div></a>)}{category === 'Tous les outils' && !query && <a className="privacy-card" href="#/confidentialite"><div className="privacy-card-icon"><ShieldCheck size={30} /></div><h3>Vos fichiers vous<br />appartiennent.</h3><p>Aucun transfert de documents.<br />Votre tranquillité, tout simplement.</p><span>Notre engagement <ArrowRight size={16} /></span></a>}</div>
      {visible.length === 0 && <div className="empty-search"><Search size={32} /><h3>Aucun outil trouvé</h3><p>Essayez « fusionner », « images » ou « organiser ».</p><button className="button secondary" onClick={() => { setQuery(''); setCategory('Tous les outils'); }}><X size={16} /> Effacer la recherche</button></div>}
    </section>
    <section className="how-section wrap" id="comment"><div className="how-intro"><span className="section-kicker">SIMPLE, DU DÉBUT À LA FIN</span><h2>Trois étapes.<br /> Et c’est déjà fait.</h2><p>Moins de clics, plus de sérénité.</p></div><div className="how-steps"><article><span className="step-num">01</span><Plus /><h3>Choisissez vos fichiers</h3><p>Glissez vos documents depuis votre appareil.</p></article><article><span className="step-num">02</span><Combine /><h3>Faites-en ce que vous voulez</h3><p>Réglez votre outil. Tout est traité dans votre navigateur.</p></article><article><span className="step-num">03</span><Download /><h3>Récupérez le résultat</h3><p>Téléchargez, puis recommencez. Vous gardez le contrôle.</p></article></div></section>
    <section className="install-banner wrap"><div className="install-symbol"><Sparkles size={25} /></div><div><h2>Vos outils PDF, toujours à portée de main.</h2><p>Installez LEVISA PDF et retrouvez vos outils même hors connexion.</p></div><button className="button secondary" onClick={onInstall}>Installer l’application <ArrowUpRight size={17} /></button></section>
  </>;
}
