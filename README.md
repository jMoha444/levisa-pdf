# LEVISA PDF

Application React en français pour manipuler des PDF **sur l’appareil de l’utilisateur**. Les documents sont traités localement. Le code et les moteurs sont hébergés avec l’application.

[Ouvrir LEVISA PDF](https://jmoha444.github.io/levisa-pdf/)

## Les 30 outils

| Famille | Outils |
|---|---|
| Organiser | Fusionner, diviser, supprimer, extraire, organiser, numériser |
| Optimiser | Compresser sans perte, réparer la structure, OCR français/anglais |
| Vers PDF | JPG/PNG, Word DOCX, PowerPoint PPTX, Excel XLSX, HTML local |
| Depuis PDF | JPG/PNG, Word DOCX, PowerPoint PPTX, Excel XLSX, PDF/A-2b |
| Modifier | Rotation, numéros, filigrane, rognage, ajout de texte/images, formulaires |
| Sécurité | Déverrouiller, protéger AES-256, signature visuelle, censure, comparaison |

Toutes les opérations sont locales. Les limites sont affichées dans chaque outil : Office approximatif, exports de texte restructuré, diapositives en images, signature sans certificat. La censure reconstruit le document en images après masquage ; le rognage seul ne supprime pas les données hors cadre. Le PDF/A-2b est aplati en images avec un profil ICC ; sa génération a été testée avec veraPDF, sans validation individuelle dans le navigateur.

Accueil responsive, recherche, six catégories, thèmes, aide, téléchargement et aperçu des PDF produits. Les modèles OCR et les moteurs sont servis avec le site et mis en cache comme ressources statiques ; aucun document n’est conservé dans ce cache.

## Démarrer sur Windows, macOS ou Linux

1. Installer Node.js 24 (ou une version compatible à partir de 22.13) depuis [nodejs.org](https://nodejs.org/).
2. Décompresser le projet et ouvrir un terminal dans son dossier (celui contenant `package.json`).
3. Exécuter :

```sh
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm run build
pnpm run preview
```

4. Ouvrir l’adresse affichée, normalement `http://127.0.0.1:4173`.

Ne pas ouvrir directement `index.html` par double-clic : les modules, Web Workers et le Service Worker nécessitent un serveur HTTP local ou HTTPS.

Le code de production se trouve dans `dist/`. Pour développer avec rechargement automatique : `pnpm dev`. Le serveur de développement reste sur l’adresse locale et retire la CSP de production pour permettre le rechargement Vite. La CSP stricte reste active dans la compilation et son aperçu : ce mode est la référence pour les essais et le contrôle réseau. Le Service Worker ne s’enregistre qu’en production.

## Vérifier

```sh
pnpm test
pnpm run typecheck
pnpm run build
pnpm run test:e2e
pnpm audit
```

Les tests de navigateur utilisent Edge installé sur Windows. Sur une autre machine, installer Chromium avec `pnpm exec playwright install chromium`, puis exécuter les tests en définissant `BROWSER_CHANNEL=chromium`. Exemple PowerShell : `$env:BROWSER_CHANNEL = 'chromium'`, puis `pnpm run test:e2e`. Sur macOS/Linux : `BROWSER_CHANNEL=chromium pnpm run test:e2e`.

Tous les tests créent des documents synthétiques. Aucun fichier personnel n’est nécessaire. Les sorties de tests sont ignorées par Git. Le rapport de livraison dans `VERIFICATION.md` précise ce qui a réellement été exécuté et ce qui reste à vérifier.

## Architecture

```text
src/
  components/  Miniatures, marque, téléchargements, installation
  pages/       Accueil, atelier PDF, confidentialité, aide
  tools/       Fonctions pures de manipulation PDF
  lib/         Validation, limites, pages, rendu PDF.js, archives
  hooks/       Cycle de vie du worker PDF
  styles/      Design responsive et thèmes
  workers/     Manipulation PDF et création des ZIP
  types/       Contrats TypeScript
public/        Manifest PWA, icône vectorielle, en-têtes Cloudflare
scripts/       Préparation des ressources hors ligne
tests/         Tests métier et tests réels de navigateur
```

Flux : sélection de fichiers → validation des octets et limites → mémoire du navigateur → PDF.js pour les aperçus / worker pdf-lib pour l’édition → Blob de résultat → téléchargement explicite → révocation des URL et libération des références.

Le lecteur reçoit des `Uint8Array`, jamais une URL documentaire. Les conversions en images utilisent uniquement le canvas, sans couche de liens ni exécution du JavaScript contenu dans les PDF. La version de PDF.js utilisée n’expose plus l’ancienne option `isEvalSupported` ; la CSP interdit l’évaluation JavaScript dynamique. Seule l’exécution WebAssembly des décodeurs locaux est autorisée.

La PWA conserve une liste de ressources statiques déterminée à la compilation. Elle ne met en cache aucun résultat à la volée et ignore les méthodes autres que GET, les autres origines et les URL avec paramètres. Une mise à jour du Service Worker attend la fermeture des anciennes pages pour éviter de changer le moteur pendant une opération.

## Confidentialité et limites

- Les requêtes ne chargent que des ressources statiques locales (polices, profil ICC, moteurs et modèles). Aucun contenu documentaire n’est envoyé.
- Aucun document, nom ou résultat stocké dans localStorage, sessionStorage, IndexedDB, une base de données ou le cloud.
- Les sources et les lecteurs PDF.js sont libérés après un succès. Les résultats restent en mémoire jusqu’à la réinitialisation, la sortie de l’outil ou la fermeture de l’onglet.
- Les Object URLs sont révoquées ; les workers de traitement sont terminés. Un nettoyage est également prévu pour les chargements rejetés et les annulations.
- 25 Mio par fichier, 50 Mio par opération, 40 fichiers, 150 pages ; 40 mégapixels pour une image importée (16 000 pixels maximum par côté), 12 mégapixels par page rendue, 100 Mio de résultats.
- Les PDF chiffrés sont traités avec qpdf dans Déverrouiller PDF, avec le mot de passe requis. Les autres outils demandent de les déverrouiller préalablement.
- Les PDF malformés peuvent échouer. Des limites et délais protègent les opérations sans constituer une garantie contre toute consommation excessive de mémoire ; un mobile peut avoir une limite plus basse.
- Les images intégrées aux PDF au-delà de 40 mégapixels ne sont pas rendues par la limite de PDF.js. Vérifier les aperçus et les résultats de documents inhabituels. La conversion peut perdre certaines caractéristiques interactives du PDF.
- Les signatures numériques peuvent être invalidées. Signets, formulaires, liens et autres éléments interactifs ne sont pas garantis après copie ou extraction de pages.
- La conversion JPG n’est pas un logiciel de retouche photo ; vérifier l’orientation des photos utilisant des métadonnées EXIF.
- Aucun effacement physique garanti de la mémoire système, du swap, des sauvegardes ou des fichiers téléchargés. Les extensions et le système de l’utilisateur ne sont pas contrôlés par le site.
- Les journaux de l’hébergeur peuvent recevoir des informations techniques sur les visites, sans le contenu documentaire.

Pour contrôler l’absence d’envoi, suivre [SECURITE.md](SECURITE.md) ou la page Confidentialité de l’application.

## Publication et maintenance

Voir [DEPLOIEMENT-GITHUB.md](DEPLOIEMENT-GITHUB.md) pour GitHub Pages et les mises à jour automatiques. Une autre possibilité est décrite dans [DEPLOIEMENT-CLOUDFLARE.md](DEPLOIEMENT-CLOUDFLARE.md).

Le dossier `.openai/` identifie la publication Sites gérée dans ce chat. Il n’est pas nécessaire pour Cloudflare Pages. Le projet demeure une application statique Vite portable.

Les dépendances sont verrouillées dans `pnpm-lock.yaml`. Avant toute mise à jour : examiner l’audit, recompiler, vérifier les transformations et relancer le test réseau. Un audit sans alerte ne garantit pas l’absence de vulnérabilités inconnues.

Les licences des moteurs et dépendances sont recensées dans [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) et copiées avec la production. Les polices sont hébergées localement.
