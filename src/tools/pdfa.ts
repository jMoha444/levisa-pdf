import { PDFDocument, PDFName, PDFString, PDFHexString } from 'pdf-lib';
export function addArchivalMetadata(pdf: PDFDocument, iccBytes: Uint8Array, idHex: string) {
  const ctx=pdf.context;
  const profile=ctx.register(ctx.stream(iccBytes,{N:3}));
  const intent=ctx.register(ctx.obj({Type:'OutputIntent',S:'GTS_PDFA1',OutputConditionIdentifier:PDFString.of('sRGB IEC61966-2.1'),Info:PDFString.of('sRGB IEC61966-2.1'),RegistryName:PDFString.of('http://www.color.org'),DestOutputProfile:profile}));
  pdf.catalog.set(PDFName.of('OutputIntents'),ctx.obj([intent]));
  const xmp=`<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>2</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
  pdf.catalog.set(PDFName.of('Metadata'),ctx.register(ctx.stream(new TextEncoder().encode(xmp),{Type:'Metadata',Subtype:'XML'})));
  const id=PDFHexString.of(idHex); ctx.trailerInfo.ID=ctx.obj([id,id]);
  // No Info dictionary: there is no second set of metadata to get out of sync.
  ctx.trailerInfo.Info=undefined;
}
