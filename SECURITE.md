# Confidentialité, tests et limites de sécurité

## Mesures mises en œuvre

- Application statique : aucun endpoint de traitement ou d’upload documentaire.
- Tout le code, les polices, PDF.js, pdf-lib et les décodeurs nécessaires sont servis depuis la même origine.
- Contrôle des signatures de fichier (octets PDF/PNG/JPG), des tailles, des nombres de fichiers/pages, des dimensions d’images et des tailles de résultats.
- PDF.js dans un worker pour la lecture ; pdf-lib dans un worker séparé pour la manipulation ; arrêt du worker en cas d’annulation ou de délai dépassé.
- PDF.js : XFA désactivé, échecs de parsing non ignorés, limites de pixels. Pas de viewer exécutant les actions JavaScript du PDF, ni de couche de liens externes.
- `object-src 'none'`, scripts locaux, pas de `unsafe-eval` JavaScript, `form-action 'none'`, connexions limitées à l’origine. `wasm-unsafe-eval` autorise uniquement les décodeurs WebAssembly locaux.
- Cloudflare ajoute les en-têtes `_headers`, notamment anti-framing, nosniff, no-referrer et restrictions de permissions. Une CSP en balise meta est également livrée pour les hébergeurs ne lisant pas `_headers` ; `frame-ancestors` nécessite un vrai en-tête HTTP.
- Pas de données documentaires dans localStorage, IndexedDB ou les caches. Aucune télémétrie applicative ni analyse d’audience.
- Nettoyage des références, canvas, URL de Blob et lecteurs. Les résultats restent disponibles pour un téléchargement explicite jusqu’à la réinitialisation ou la sortie de l’outil.

## Contrôle manuel du réseau

1. Utiliser un fichier synthétique contenant un marqueur unique, par exemple `TEST-CONFIDENTIEL-1234`.
2. Compiler et servir la production : `pnpm run build`, puis `pnpm run preview`.
3. Ouvrir Réseau (F12) et laisser charger les fichiers statiques. Effacer la liste.
4. Importer, modifier et télécharger. Observer les requêtes, y compris celles des workers.
5. Accepter uniquement les lectures GET des ressources statiques connues. Il ne doit y avoir aucun corps de requête documentaire, aucune URL portant le nom du PDF, aucun POST/PUT/PATCH et aucune destination tierce.
6. Dans Stockage/Application, vérifier que le cache ne contient que le code, les polices, icônes et ressources de PDF.js. localStorage, sessionStorage et IndexedDB ne doivent contenir aucun document.
7. Activer « Hors ligne » après l’indicateur « Prêt hors ligne », recharger, puis importer **de nouveaux fichiers** et refaire l’opération.
8. Réinitialiser l’outil : les téléchargements et aperçus doivent disparaître. Les URL Blob des résultats doivent devenir inutilisables.

Les tests Playwright automatisent les opérations principales, l’observation des requêtes sur tous les parcours, le contrôle de stockage, l’invalidation d’une URL Blob et une nouvelle fusion hors ligne. Ils vérifient les vrais octets et les dimensions/rotations des PDF produits, ainsi que le contenu des ZIP.

## Ce que ces tests ne prouvent pas

Un audit de dépendances est un contrôle d’avis connus à une date donnée, pas une certification. Les essais ne couvrent pas tous les PDF possibles, l’intégralité des navigateurs et systèmes, tous les fichiers malveillants, les extensions du navigateur ni la sécurité du compte d’hébergement. Une CSP ne protège pas contre toutes les compromissions de la chaîne de livraison du code.

Il n’y a pas d’effacement physique garanti de RAM, swap, sauvegardes et téléchargements. Le système peut conserver ses propres copies. Un appareil ou une extension compromis échappent au contrôle du site.

Ne pas présenter cette application comme un antivirus, un outil d’anonymisation garanti ou un outil de signature juridique. Garder les originaux, vérifier le rendu et contrôler les signatures et formulaires du document de sortie.

## Maintenance

Surveiller les avis concernant PDF.js, pdf-lib, Vite et les autres dépendances. Mettre à jour dans une branche, puis refaire les tests et le contrôle réseau avant publication. Ne jamais ajouter une conversion distante ou du suivi documentaire sans modifier explicitement l’architecture, les tests et l’information aux utilisateurs.
