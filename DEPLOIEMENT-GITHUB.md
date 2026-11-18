# Publier LEVISA PDF sur GitHub Pages

Le projet comprend un workflow `.github/workflows/pages.yml` qui compile et publie automatiquement la branche `main`.

1. Déposer le projet dans un dépôt GitHub. Ne pas envoyer `node_modules`, les données de tests, `.openai`, `.git` ou des documents personnels.
2. Ouvrir **Settings → Pages** du dépôt et sélectionner **GitHub Actions** comme source de publication.
3. Dans **Actions**, lancer « Publier LEVISA PDF » avec **Run workflow**, ou pousser un nouveau commit sur `main`.
4. Attendre le succès des étapes de compilation et de publication. L’adresse réelle du site apparaît dans le résultat du déploiement et dans Settings → Pages.

Sur un dépôt nommé `levisa-pdf`, l’adresse habituelle est `https://IDENTIFIANT.github.io/levisa-pdf/`. Elle doit être confirmée par GitHub avant d’être considérée comme publiée.

Le workflow détermine automatiquement le chemin du site. Les fichiers JavaScript, PDF.js, les icônes et le Service Worker utilisent ce même chemin. Les documents restent traités localement.

Sur GitHub Free, Pages est disponible pour les dépôts publics. Les dépôts privés nécessitent une offre compatible. Un dépôt public rend son code source consultable par tous. Voir les [conditions de disponibilité de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Pour tester localement un déploiement dans un sous-dossier avec PowerShell :

```powershell
$env:BASE_PATH = '/levisa-pdf/'
pnpm run build
pnpm run preview
```

Ouvrir `http://127.0.0.1:4173/levisa-pdf/`. Supprimer ensuite la variable avec `Remove-Item Env:BASE_PATH` avant de compiler pour Sites ou un domaine à la racine.

GitHub Pages ne lit pas les règles Cloudflare `_headers`. La CSP en balise meta reste présente ; certaines protections uniquement disponibles en en-têtes HTTP, comme `frame-ancestors`, dépendent de l’hébergeur. Les journaux techniques de GitHub ne contiennent pas les PDF traités par l’application.

Références : [workflows Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [source de publication](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
