# Vérification du 17 novembre 2026

- Construction TypeScript/Vite réussie.
- 35 tests unitaires réussis : outils initiaux, sélection de pages, numéros, filigrane, géométrie du rognage, champs AcroForm, AES-256, rejet de mot de passe incorrect, structure PDF/A.
- Essais dans le navigateur sur documents synthétiques : Word, PowerPoint, Excel, HTML vers PDF ; PDF vers DOCX, XLSX et PPTX ; OCR français ; réparation ; déverrouillage ; censure tracée sur la page ; comparaison ; numérisation depuis PNG ; ajout de texte avec accents.
- Rendu Word et PowerPoint inspecté visuellement après correction.
- PDF/A-2b produit par le navigateur : veraPDF 1.30.4, 144 règles réussies, 0 échec, 273 vérifications réussies. Ce résultat concerne le document de test de deux pages, pas une certification de tous les fichiers possibles.
- Censure : sortie de deux pages, aucun objet police, formulaire, métadonnée XMP ni arbre de pièces jointes d’origine.

Les tests E2E historiques couvrent les sept outils initiaux ; leurs assertions de libellés doivent être adaptées au nouveau catalogue avant réutilisation. Les moteurs Office ne sont pas des conversions fidèles universelles. La caméra mobile réelle, tous les navigateurs, les très gros documents et tous les cas malformés ne sont pas couverts.
