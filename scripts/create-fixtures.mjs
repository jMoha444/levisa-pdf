import {writeFile,mkdir} from 'node:fs/promises';import {Document,Paragraph,TextRun,Packer} from 'docx';import PptxGenJS from 'pptxgenjs';import * as XLSX from 'xlsx';import {PDFDocument} from 'pdf-lib';
await mkdir('../fixtures',{recursive:true});
const d=new Document({sections:[{children:[new Paragraph({children:[new TextRun({text:'LEVISA — essai de conversion',bold:true})]}),new Paragraph('Bonjour ! Voici un document de test avec des accents : été, à bientôt.')]}]});await writeFile('../fixtures/test.docx',await Packer.toBuffer(d));
const p=new PptxGenJS();p.addSlide().addText('LEVISA PDF — diapositive de test',{x:1,y:1,w:8,h:2,fontSize:28});await p.writeFile({fileName:'../fixtures/test.pptx'});
const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet([['Produit','Quantité','Prix'],['Café',2,4.5],['Thé',3,6]]),'Essai');await writeFile('../fixtures/test.xlsx',XLSX.write(b,{type:'buffer',bookType:'xlsx'}));
await writeFile('../fixtures/test.html','<h1>LEVISA PDF</h1><p>Un document <b>HTML</b> local avec des accents : été.</p><table><tr><td>Un</td><td>Deux</td></tr></table>');
const pdf=await PDFDocument.create();let page=pdf.addPage([595,842]);page.drawText('LEVISA PDF TEST SECRET 123',{x:50,y:700,size:24});page=pdf.addPage([595,842]);page.drawText('PAGE DEUX',{x:50,y:700,size:24});await writeFile('../fixtures/test.pdf',await pdf.save());
