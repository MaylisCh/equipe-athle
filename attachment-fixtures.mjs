// Portable workbook fixtures, generated in memory; never touches the coach's files.
import {deflateRawSync} from 'node:zlib';
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function xlsxFixture(label='Musculation — bloc 1',overrides={}){
 const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const files={
  '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>',
  '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Force" sheetId="1" r:id="rId1"/><sheet name="Récupération" sheetId="2" r:id="rId2"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
  'xl/styles.xml':'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts><font><sz val="11"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="14"/></font></fonts><fills><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF166534"/></patternFill></fill></fills><borders><border/></borders><cellXfs><xf fontId="0" fillId="0" borderId="0" numFmtId="0"/><xf fontId="1" fillId="1" borderId="0" numFmtId="0"><alignment horizontal="center" wrapText="1"/></xf></cellXfs></styleSheet>',
  'xl/worksheets/sheet1.xml':`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="24"/><col min="2" max="3" width="15"/></cols><sheetData><row r="1" ht="35"><c r="A1" t="inlineStr" s="1"><is><t>${escape(label)}</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Squat</t></is></c><c r="B2" t="inlineStr"><is><t>3 × 8</t></is></c><c r="C2"><f>20*2</f><v>40</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>&lt;img src=x onerror=alert(1)&gt;</t></is></c></row></sheetData><mergeCells><mergeCell ref="A1:C1"/></mergeCells></worksheet>`,
  'xl/worksheets/sheet2.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Repos entre séries : 2 min</t></is></c></row></sheetData></worksheet>'
 };
 Object.assign(files,overrides);
 const local=[],central=[];let offset=0;
 for(const [path,text] of Object.entries(files)){
  const name=Buffer.from(path),raw=Buffer.from(text),compressed=deflateRawSync(raw),crc=crc32(raw),header=Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(8,8);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(raw.length,22);header.writeUInt16LE(name.length,26);
  const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(8,10);directory.writeUInt32LE(crc,16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(raw.length,24);directory.writeUInt16LE(name.length,28);directory.writeUInt32LE(offset,42);
  local.push(header,name,compressed);central.push(directory,name);offset+=header.length+name.length+compressed.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,directory,end]);
}
