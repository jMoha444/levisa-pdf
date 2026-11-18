import { Combine, Scissors, LayoutGrid, RotateCw, Images, FileImage, Minimize2, Trash2, Copy, ScanLine, Wrench, ScanText, FileType2, Presentation, Table2, Code2, Archive, Hash, Stamp, Crop, Pencil, TextCursorInput, LockKeyholeOpen, LockKeyhole, PenLine, RectangleHorizontal, GitCompareArrows, type LucideIcon } from 'lucide-react';
import type { Category, ToolId } from '../types';
export type Tool = { id: ToolId; name: string; short: string; description: string; detail: string; icon: LucideIcon; color: string; category: Category; action: string; badge?: string };
const item = (id: ToolId, name: string, description: string, icon: LucideIcon, category: Category, color: string, action = 'Créer le résultat', badge?: string): Tool => ({id, name, short:name, description, detail:description, icon, category, color, action, badge});
export const tools: Tool[] = [
  item('merge','Fusionner PDF','Plusieurs documents, un seul PDF. Dans l’ordre qui vous convient.',Combine,'Organiser','purple','Fusionner les PDF','Le plus utilisé'),
  item('split','Diviser PDF','Séparez votre document en plusieurs fichiers ou groupes de pages.',Scissors,'Organiser','blue','Diviser le PDF'),
  item('delete','Supprimer des pages','Retirez les pages inutiles et conservez le reste du document.',Trash2,'Organiser','orange','Supprimer les pages'),
  item('extract','Extraire des pages','Créez un nouveau PDF avec les pages que vous choisissez.',Copy,'Organiser','pink','Extraire les pages'),
  item('organize','Organiser PDF','Déplacez, ajoutez, supprimez ou faites pivoter vos pages.',LayoutGrid,'Organiser','orange','Enregistrer le PDF'),
  item('scan','Numériser au format PDF','Photographiez un document ou importez vos photos, puis ajustez-les.',ScanLine,'Organiser','green','Créer le PDF'),
  item('compress','Compresser PDF','Optimisez la structure du PDF sans dégrader ses images.',Minimize2,'Optimiser','indigo','Optimiser le PDF','Sans perte'),
  item('repair','Réparer PDF','Tentez de reconstruire la structure d’un PDF endommagé.',Wrench,'Optimiser','green','Réparer le PDF'),
  item('ocr','OCR PDF','Rendez le texte des pages scannées recherchable, en français ou en anglais.',ScanText,'Optimiser','green','Reconnaître le texte'),
  item('images-pdf','JPG en PDF','Transformez vos images JPG et PNG en un document soigné.',Images,'Vers PDF','green','Créer le PDF'),
  item('word-pdf','Word en PDF','Convertissez un DOCX en pages PDF avec un aperçu de la mise en page.',FileType2,'Vers PDF','blue'),
  item('ppt-pdf','PowerPoint en PDF','Convertissez les diapositives d’un PPTX en pages PDF.',Presentation,'Vers PDF','orange'),
  item('excel-pdf','Excel en PDF','Exportez les valeurs de vos feuilles XLSX en tableaux paginés.',Table2,'Vers PDF','green'),
  item('html-pdf','HTML en PDF','Transformez un fichier HTML local en PDF, sans charger de contenu distant.',Code2,'Vers PDF','pink'),
  item('pdf-images','PDF en JPG','Vos pages deviennent des images JPG ou PNG, au choix.',FileImage,'Depuis PDF','cyan','Convertir en images'),
  item('pdf-word','PDF en Word','Récupérez le texte dans un DOCX modifiable, avec des paragraphes reconstruits.',FileType2,'Depuis PDF','blue'),
  item('pdf-ppt','PDF en PowerPoint','Une page, une diapositive : préservez le rendu sous forme d’images.',Presentation,'Depuis PDF','orange'),
  item('pdf-excel','PDF en Excel','Récupérez le texte positionné en lignes et colonnes dans un XLSX.',Table2,'Depuis PDF','green'),
  item('pdf-a','PDF en PDF/A','Créez une version d’archivage PDF/A-2b aplatie en images.',Archive,'Depuis PDF','indigo'),
  item('rotate','Faire pivoter PDF','Remettez toutes vos pages, ou certaines, dans le bon sens.',RotateCw,'Modifier','pink','Pivoter le PDF'),
  item('numbers','Ajouter des numéros de pages','Choisissez le premier numéro et la position de la pagination.',Hash,'Modifier','purple'),
  item('watermark','Ajouter un filigrane','Ajoutez votre texte en transparence sur les pages choisies.',Stamp,'Modifier','purple'),
  item('crop','Rogner PDF','Définissez visuellement la zone visible à conserver.',Crop,'Modifier','pink'),
  item('edit','Modifier PDF','Ajoutez du texte et des images à l’endroit de votre choix.',Pencil,'Modifier','purple'),
  item('forms','Formulaires PDF','Remplissez les champs existants ou ajoutez des champs et cases à cocher.',TextCursorInput,'Modifier','blue'),
  item('unlock','Déverrouiller PDF','Retirez le chiffrement avec le mot de passe du document.',LockKeyholeOpen,'Sécurité','blue','Déverrouiller le PDF'),
  item('protect','Protéger PDF','Protégez l’ouverture du document par un mot de passe AES-256.',LockKeyhole,'Sécurité','indigo','Protéger le PDF'),
  item('sign','Signer PDF','Dessinez votre signature ou importez-la, puis placez-la sur vos pages.',PenLine,'Sécurité','purple'),
  item('redact','Censurer PDF','Masquez des zones, puis reconstruisez les pages pour supprimer leur contenu.',RectangleHorizontal,'Sécurité','pink','Censurer définitivement'),
  item('compare','Comparer PDF','Comparez deux documents page par page et repérez les différences visuelles.',GitCompareArrows,'Sécurité','cyan','Comparer les documents'),
];
export const categories: Category[] = ['Tous les outils','Organiser','Optimiser','Vers PDF','Depuis PDF','Modifier','Sécurité'];
export const basicTools = new Set<ToolId>(['merge','split','organize','rotate','images-pdf','pdf-images','compress']);
export const getTool = (id: ToolId) => tools.find(tool => tool.id === id)!;
