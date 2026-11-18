# Dépendances et licences

Versions installées et examinées le 14 novembre 2026, verrouillées dans `pnpm-lock.yaml`.

| Bibliothèque | Version | Licence | Usage |
|---|---|---|---|
| React / React DOM | 19.3.1 | MIT | Interface |
| pdf-lib | 1.17.1 | MIT | Assemblage et écriture des PDF |
| PDF.js / pdfjs-dist | 6.5.438 | Apache-2.0 | Lecture, rendu et décodeurs locaux |
| fflate | 0.8.3 | MIT | Archives ZIP |
| Lucide React | 1.73.0 | ISC | Icônes |
| Manrope, Inter via Fontsource | 5.3.0 | SIL OFL-1.1 | Polices servies localement |
| Vite | 8.3.8 | MIT | Compilation |
| Tailwind CSS | 4.3.5 | MIT | Styles et normalisation |
| TypeScript | 7.0.2 | Apache-2.0 | Vérification des types |
| Vitest | 5.1.0 | MIT | Tests métier |
| Playwright | 1.65.1 | Apache-2.0 | Tests de navigateur |

Les licences des dépendances livrées au navigateur sont copiées dans `dist/licenses/`, celle de PDF.js dans `dist/pdfjs/LICENSE`. Les répertoires de données PDF.js conservent leurs notices propres. Les dépendances de développement ne sont pas chargées par les visiteurs.

Références primaires : [pdf-lib, documentation et limites](https://github.com/Hopding/pdf-lib), [PDF.js](https://mozilla.github.io/pdf.js/getting_started/), [licence PDF.js](https://github.com/mozilla/pdf.js/blob/master/LICENSE), [Vite](https://vite.dev/guide/), [Fontsource](https://fontsource.org/), [Lucide](https://lucide.dev/license).

pdf-lib est complété par qpdf pour le chiffrement et le déverrouillage. La bibliothèque ne constitue pas un moteur de conversion Office ni un compresseur d’images avancé. Son audit ne remplace pas une revue de sécurité ; la version publiée reste ancienne malgré son usage répandu. PDF.js est utilisé dans sa version disponible à la réalisation, avec une CSP stricte et sans exécuter les scripts des documents.

## Extension du 17 novembre 2026

- qpdf 12.4.2 (Apache-2.0), wrapper @soulehshaikh99/qpdf-wasm 0.4.1 (ISC) : protection, déverrouillage, réparation.
- Tesseract.js 7.0.0 et core 7.0.0 (Apache-2.0), données françaises/anglaises Tesseract : OCR local. Les licences du core et des modèles sont incluses.
- @pdf-lib/fontkit 1.1.1 (MIT), Noto Sans (SIL OFL-1.1) : texte Unicode incorporé. Licence upstream fontkit conservée, le paquet fork ne livre pas de fichier de licence séparé.
- docx-preview 0.4.1 (Apache-2.0), docx 9.15.4 (MIT), PptxGenJS 4.0.1 (MIT).
- @office-kit/pptx 0.28.0 et @office-kit/pptx-preview 0.21.0 (MIT).
- SheetJS CE 0.20.3 (Apache-2.0), téléchargé depuis le CDN officiel lors de l’installation uniquement.
- html2canvas 1.4.1 (MIT), DOMPurify 3.4.18 (Apache-2.0 ou MPL-2.0).
- Profil sRGB2014.icc : International Color Consortium, licence autorisant copie, distribution et intégration, https://registry.color.org/profile-library/#license . Profil : https://registry.color.org/rgb-registry/profiles/sRGB2014.icc .

Les archives et macros Office sont bornées, les relations externes retirées, les HTML assainis. Aucun Ghostscript ou LibreOffice distant n’est utilisé. Les bibliothèques distribuées ne changent pas l’attribution des commits du dépôt utilisateur.
