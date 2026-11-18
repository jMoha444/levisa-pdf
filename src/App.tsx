import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, Download, Heart, LockKeyhole, Menu, Moon, Sun, X } from 'lucide-react';
import { Brand } from './components/Brand';
import { Home } from './pages/Home';
import { Workspace } from './pages/Workspace';
import { Privacy } from './pages/Privacy';
import { Help } from './pages/Help';
import { InstallDialog } from './components/InstallDialog';
import { tools, basicTools } from './lib/tools';
import { AdvancedWorkspace } from './pages/AdvancedWorkspace';
import type { ToolId } from './types';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export default function App() {
  const [route, setRoute] = useState(location.hash || '#/');
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const [menuOpen, setMenuOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => { const update = () => { setRoute(location.hash || '#/'); setMenuOpen(false); window.scrollTo(0, 0); }; window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  useEffect(() => {
    const onInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    window.addEventListener('beforeinstallprompt', onInstall);
    const offline = () => setOfflineReady(true);
    window.addEventListener('levisa-offline-ready', offline);
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistration().then(registration => { if (registration?.active) setOfflineReady(true); });
    }
    return () => { window.removeEventListener('beforeinstallprompt', onInstall); window.removeEventListener('levisa-offline-ready', offline); };
  }, []);
  const toolId = route.startsWith('#/outil/') ? route.slice(8) as ToolId : null;
  const validTool = tools.some(tool => tool.id === toolId);
  const privacy = route === '#/confidentialite';
  const help = route === '#/aide';
  const install = async () => { if (!installEvent) return; await installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null); };
  return <>
    <a className="skip-link" href="#contenu" onClick={event => { event.preventDefault(); document.getElementById('contenu')?.focus(); }}>Aller au contenu</a>
    <header className="site-header"><div className="header-inner wrap"><Brand /><nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Navigation principale"><a href="#/" className={!privacy && !help ? 'nav-active' : ''}>Tous les outils <ChevronDown size={13} /></a><a href="#/confidentialite" className={privacy ? 'nav-active' : ''}>Confidentialité</a><a href="#/aide" className={help ? 'nav-active' : ''}>Comment ça marche</a></nav><div className="header-actions"><button className="icon-button theme-button" aria-label={dark ? 'Activer le mode clair' : 'Activer le mode sombre'} onClick={() => setDark(v => !v)}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button><button className="button install-header" aria-label="Installer l’app" onClick={() => setInstallOpen(true)}><Download size={16} /><span>Installer l’app</span></button><button className="icon-button menu-toggle" aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X /> : <Menu />}</button></div></div></header>
    <div id="contenu" tabIndex={-1}>{validTool && toolId ? basicTools.has(toolId) ? <Workspace toolId={toolId} key={toolId} /> : <AdvancedWorkspace toolId={toolId} key={toolId} /> : privacy ? <Privacy /> : help ? <Help /> : <main><Home onInstall={() => setInstallOpen(true)} /></main>}</div>
    <footer className="site-footer"><div className="wrap"><div className="footer-top"><div><Brand /><p>De bons outils. Des documents qui restent à vous.</p></div><div className="footer-links"><a href="#/confidentialite">Confidentialité</a><a href="#/aide">Besoin d’aide ? <ArrowUpRight size={13} /></a><button onClick={() => setInstallOpen(true)}>Installer l’application</button></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} LEVISA PDF <i>·</i> Pensé pour votre tranquillité.</span><span><LockKeyhole size={12} /> Vos documents restent sur votre appareil.</span><span className={offlineReady ? 'offline-ready' : ''}>{offlineReady && <Check size={13} />}{offlineReady ? 'Prêt hors ligne' : 'Fait avec soin'}{!offlineReady && <Heart size={12} />}</span></div></div></footer>
    {installOpen && <InstallDialog close={() => setInstallOpen(false)} install={() => void install()} ready={offlineReady} canInstall={!!installEvent} />}
  </>;
}
