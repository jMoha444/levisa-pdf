# Publier LEVISA PDF gratuitement sur Cloudflare Pages

Le site fourni est statique. Vous n’avez besoin ni de serveur de conversion, ni de base de données, ni de stockage de documents. Les visiteurs n’ont aucun compte à créer. Seul le propriétaire crée ses comptes GitHub et Cloudflare pour publier et administrer le code.

## 1. Créer le dépôt GitHub

1. Aller sur [GitHub](https://github.com/) et créer un compte si nécessaire.
2. Cliquer sur **New repository** et nommer le dépôt `levisa-pdf`.
3. Choisir **Private** si vous souhaitez garder le code non public. Cela n’empêche pas le site Cloudflare d’être public.
4. Créer le dépôt vide. Ne pas ajouter un deuxième README si vous allez importer le projet fourni.
5. Pour débuter sans commandes Git, installer [GitHub Desktop](https://desktop.github.com/), ouvrir votre projet comme dépôt local, créer le premier commit et publier le dépôt sous votre compte.
6. Inclure `src`, `public`, `scripts`, `tests`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, les configurations et les documents. Ne jamais envoyer `node_modules`, les rapports de tests, des `.env`, des jetons ou vos PDF personnels. Le `.gitignore` fourni écarte les fichiers de travail courants.

Alternative par terminal, depuis le dossier du projet, après installation de Git :

```sh
git init
git add .
git commit -m "Premiere version de LEVISA PDF"
git branch -M main
git remote add origin https://github.com/VOTRE-NOM/levisa-pdf.git
git push -u origin main
```

Remplacer `VOTRE-NOM` par votre identifiant GitHub. L’authentification s’effectue avec le navigateur ou le gestionnaire Git ; aucun jeton ne doit être enregistré dans le code.

## 2. Connecter Cloudflare Pages

1. Créer un compte sur [Cloudflare](https://dash.cloudflare.com/sign-up).
2. Dans le tableau de bord, ouvrir **Workers & Pages**, puis la création d’une application **Pages** avec import d’un dépôt Git existant.
3. Choisir GitHub. Autoriser uniquement l’accès au dépôt utile lorsque cette option est proposée.
4. Sélectionner `levisa-pdf`, puis la branche de production `main`.
5. Utiliser les réglages suivants :

| Réglage | Valeur |
|---|---|
| Nom du projet | `levisa-pdf` si disponible, sinon un nom de votre choix |
| Framework | Vite (ou None en saisissant les valeurs manuellement) |
| Dossier racine | Racine du dépôt contenant `package.json` |
| Commande de compilation | `pnpm run build` |
| Dossier de sortie | `dist` |
| Variable de compilation `NODE_VERSION` | `24` |
| Variable de compilation `PNPM_VERSION` | `11.25.0` |

6. Lancer **Save and Deploy**. Cloudflare installe les dépendances, compile et publie les fichiers de `dist`.
7. À la fin, ouvrir l’URL `https://NOM-CHOISI.pages.dev` affichée par Cloudflare. Le nom exact est soumis à sa disponibilité ; `levisa-pdf.pages.dev` n’est pas réservé par cette livraison.

Les noms de menus peuvent évoluer. La procédure officielle de référence est le [guide d’intégration Git de Cloudflare Pages](https://developers.cloudflare.com/pages/get-started/git-integration/). La [configuration de compilation](https://developers.cloudflare.com/pages/configuration/build-configuration/) détaille les réglages et l’image de compilation.

Ne pas créer de Pages Functions, de bucket R2, de base D1 ou de secret API pour ce projet. Le fichier `public/_headers` devient `dist/_headers` et applique la CSP et les en-têtes de sécurité sur Cloudflare.

## 3. Vérifier en ligne

1. Ouvrir l’adresse dans une fenêtre privée : l’application doit s’afficher sans connexion.
2. Fusionner deux PDF d’essai, télécharger le résultat et l’ouvrir.
3. Tester un intervalle de division, une rotation et une image JPG/PNG.
4. Consulter Réseau dans les outils du navigateur. Vérifier qu’aucun document, nom de fichier ou contenu n’est transmis et qu’aucune requête POST/PUT/PATCH n’est envoyée.
5. Attendre **Prêt hors ligne**, couper la connexion, recharger le site et traiter de nouveaux fichiers d’essai.
6. Cliquer **Supprimer mes fichiers / Recommencer** : les aperçus et téléchargements temporaires disparaissent.
7. Vérifier sur vos téléphones réels ; la livraison a été testée sur Edge et avec des dimensions mobiles, ce qui ne remplace pas un essai iPhone/Safari ou Android réel.

L’hébergement journalise éventuellement les visites et leurs informations réseau ; cela est distinct d’un envoi de vos documents. Voir [SECURITE.md](SECURITE.md).

## 4. Publier une mise à jour

Modifier le code, exécuter les tests et la compilation, puis pousser un nouveau commit sur `main`. Cloudflare lance une nouvelle compilation. Pour que l’application installée active sa nouvelle version, fermer ses anciens onglets/fenêtres puis la rouvrir après le déploiement. Le cache contient uniquement le code et les ressources statiques.

Conserver le fichier de verrouillage des dépendances et contrôler les résultats avant chaque mise à jour des moteurs PDF.

## Offre gratuite vérifiée le 14 novembre 2026

Pour Pages Free : 500 compilations mensuelles, une compilation à la fois, 20 minutes maximum par compilation, 20 000 fichiers et 25 Mio maximum par fichier statique. Cette application représente environ 6 Mo de ressources, très en dessous de ces limites. [Limites officielles de Pages](https://developers.cloudflare.com/pages/platform/limits/).

Les requêtes vers les ressources statiques sont gratuites et illimitées selon la documentation Cloudflare. Ce projet ne comporte pas de Functions, dont les quotas sont distincts. Un domaine personnalisé acheté reste facultatif et peut être payant. [Tarification officielle](https://developers.cloudflare.com/pages/functions/pricing/#static-asset-requests).

Ces conditions peuvent changer : vérifier les pages officielles avant de publier. Aucun abonnement payant ni nom de domaine acheté n’est nécessaire pour utiliser l’adresse fournie en `pages.dev` dans les limites de l’offre.

## Sites ou Cloudflare ?

Sites permet la publication immédiate depuis ce chat et les futures modifications via le plugin. Cloudflare Pages vous donne une publication statique sous votre propre compte, avec une offre gratuite documentée et un déploiement automatique depuis GitHub. Le même code fonctionne sur les deux ; les visiteurs ne transmettent pas leurs documents dans les deux cas.

## Option rapide : déposer le ZIP prêt à publier

L’archive `levisa-pdf-cloudflare.zip` contient déjà la production, avec `index.html` à sa racine. Dans Cloudflare, choisir Workers & Pages → création d’une application Pages → dépôt des fichiers par glisser-déposer, donner un nom au projet, déposer ce ZIP puis publier. Aucun logiciel ni compilation locale n’est nécessaire pour cette première publication.

Cette méthode accepte un ZIP ou un dossier, jusqu’à 1 000 fichiers et 25 Mio par fichier : l’archive fournie est en dessous de ces limites. Attention : un projet créé en Direct Upload ne peut pas ensuite basculer sur l’intégration Git ; il faut alors créer un autre projet. Pour les mises à jour automatiques depuis GitHub, privilégier la procédure principale ci-dessus. [Documentation officielle Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).
