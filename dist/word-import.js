/* Local-only DOCX import for the Aptara Rise storyboard table structure. */
(function(root){
'use strict';
const WORD='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const MAX_TOTAL=64*1024*1024,MAX_IMAGE=2*1024*1024;
const clean=s=>String(s||'').replace(/\u00a0/g,' ').trim();
const isPlaceholder=s=>!clean(s)||/^\[\s*(?:enter|insert|add|select|provide|replace|paste|choose)[\s\S]*\]$/i.test(clean(s));
const isAsset=s=>/\b(filename|file name|asset reference)\b/i.test(s);
const isSetup=s=>/\b(coordinates?|completion|trigger|layout|placement|appearance|spacing|canvas size|shapes and positions|action and target|correct answer|all correct options|character and background|randomization|draw rules|accessible format notes|requirements|category assignment|media dependencies)\b/i.test(s)||/^item \d+ category$/i.test(s)||/^required yes or no$/i.test(s);
function parseEntries(entries,fileName){
 let active=null,section='',projectName='',records=[],messages=[];
 for(const entry of entries){
  if(entry.kind==='paragraph'){
   const text=clean(entry.text),m=text.match(/^(S\d+[-–]B\d+)\s+(.+)$/i);
   if(m){active={sourceId:m[1].replace('–','-').toUpperCase(),type:clean(m[2]),section,fields:[],nearImages:[],warnings:[]};records.push(active)}
   else if(/^Section ID:/i.test(text)){section=text.replace(/^.*?Section title:\s*/i,'');active=null}
   else if(entry.heading&&/^Heading[ _]?[12]$/i.test(entry.heading)){active=null}
   if(entry.images?.length&&active)active.nearImages.push(...entry.images);
  }else if(entry.kind==='table'){
   const header=entry.rows?.[0]?.cells?.map(c=>clean(c.text).toLowerCase());
   if(!header)continue;
   if(header[0]==='field'&&header[1]==='value'){
    for(const row of entry.rows.slice(1)){if(clean(row.cells[0]?.text).toLowerCase()==='lesson title'&&!isPlaceholder(row.cells[1]?.text))projectName=clean(row.cells[1].text)}
   }else if(header[0]==='field'&&header[1]==='approved content'){
    if(!active){messages.push('A content table had no recognizable block ID heading. It was not imported.');continue}
    if(active.fields.length)active.warnings.push('More than one content table belongs to this block. Check its boundaries.');
    for(const row of entry.rows.slice(1)){
     const [labelCell,valueCell]=row.cells;if(!labelCell||!valueCell){active.warnings.push('A table row has a missing cell.');continue}
     const label=clean(labelCell.text);if(!label){active.warnings.push('A content row has no field label.');continue}
     if(valueCell.nested)active.warnings.push(`${label}: nested table content needs a manual check.`);
     active.fields.push({label,text:isPlaceholder(valueCell.text)?'':valueCell.text.trim(),images:valueCell.images||[],missing:isPlaceholder(valueCell.text)&&!(valueCell.images||[]).length});
    }
   }
  }
 }
 const recognized=records.filter(r=>r.fields.length);if(!recognized.length)throw Error('No supported block records found. Use the Rise storyboard template with S01-B01 headings and Field / Approved content tables.');
 const counts=new Map();recognized.forEach(r=>counts.set(r.sourceId,(counts.get(r.sourceId)||0)+1));
 const blocks=recognized.map((r,i)=>{
  let parts=[],notes=[],assets=[],warnings=[...r.warnings],missing=[],populated=0;const imagesSeen=new Set();
  function addImage(img,field,name,alt){if(img.warning)warnings.push(img.warning);if(!img.data)return;if(imagesSeen.has(img.key))return;imagesSeen.add(img.key);assets.push({name:name||img.name||'Embedded image',data:img.data,alt:alt||img.alt||'',field});}
  for(const f of r.fields){
   if(f.missing)missing.push(f.label);else populated++;
   const assetBase=s=>s.toLowerCase().replace(/filename|file name|alt text|accessible description|image|media/g,'').replace(/\s/g,'');const relatedAlt=r.fields.find(x=>/alt text|accessible description/i.test(x.label)&&assetBase(x.label)===assetBase(f.label));
   const codeField=/html css and javascript/i.test(f.label)&&(/<|\b(function|const|let|var|document)\b/.test(f.text)||f.text.length>500);if(isAsset(f.label)&&!codeField){
    if(f.images.length)for(const image of f.images)addImage(image,f.label,f.text,relatedAlt?.text);
    if(f.text&&!f.images.some(img=>img.data))assets.push({name:f.text,data:'',alt:relatedAlt?.text||'',field:f.label});
   }else{
    if(isSetup(f.label)){if(f.text)notes.push(`${f.label}: ${f.text}`)}
    else parts.push({label:f.label,text:f.text});
    for(const image of f.images)addImage(image,f.label,'',relatedAlt?.text);
   }
   for(const image of f.images)if(image.warning&&!warnings.includes(image.warning))warnings.push(image.warning);
  }
  for(const image of r.nearImages)addImage(image,'Image near block');
  if(r.nearImages.length)warnings.push('An image was found near this block. Confirm its association.');
  if(counts.get(r.sourceId)>1)warnings.push(`Duplicate block ID ${r.sourceId}. Rename the IDs in Word or distinguish the blocks before handoff.`);
  if(assets.length>20){warnings.push('More than 20 asset entries found. Import was limited to the first 20; attach remaining assets manually.');assets=assets.slice(0,20)}
  if(notes.join('\n').length>20000)throw Error(`${r.sourceId} has more than 20,000 characters of setup notes. Split this block before import.`);if(parts.length>100)throw Error(`${r.sourceId} contains more than 100 content pieces. Split this record in Word.`);
  if(r.fields.length>100)warnings.push('This block has many fields. Check all content and setup notes.');
  const heading=parts.find(p=>/^(heading|title|question|scenario title|interaction title|chart title)$/i.test(p.label)&&p.text)?.text;
  const populatedRecord=populated>0||assets.some(a=>a.data);
  return {id:`word-${i}`,title:`${r.sourceId} · ${heading?.split('\n')[0]||r.type}`.slice(0,150),type:r.type.slice(0,80),notes:notes.join('\n'),parts,done:false,reviewed:false,sourceId:r.sourceId,sourceSection:r.section,sourceFile:fileName,missingFields:missing,importWarnings:[...new Set(warnings)],assets,populated:populatedRecord};
 });
 if(blocks.length>500)throw Error('This document has more than 500 block records. Import one lesson at a time.');
 return {name:(projectName||fileName.replace(/\.docx$/i,'')).slice(0,150),blocks,messages:[...new Set(messages)],total:blocks.length,empty:blocks.filter(b=>!b.populated).length};
}
function preflight(buffer){
 const view=new DataView(buffer);let end=-1;
 for(let i=buffer.byteLength-22;i>=Math.max(0,buffer.byteLength-65557);i--){if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===buffer.byteLength){end=i;break}}
 if(end<0)throw Error('This file is not a readable DOCX archive. Save it again as .docx in Word.');
 const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);if(count===65535||offset===0xffffffff||count>2500)throw Error('This Word archive is too complex. Import a smaller lesson document.');
 let pos=offset,total=0,sizes=new Map();const decoder=new TextDecoder();
 for(let i=0;i<count;i++){
  if(pos+46>buffer.byteLength||view.getUint32(pos,true)!==0x02014b50)throw Error('The Word archive is damaged.');
  const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true),size=view.getUint32(pos+24,true),nameLen=view.getUint16(pos+28,true),extraLen=view.getUint16(pos+30,true),commentLen=view.getUint16(pos+32,true);
  if(flags&1)throw Error('Password-protected Word documents are not supported. Save an unprotected copy for import.');
  if(![0,8].includes(method)||size===0xffffffff)throw Error('This Word archive uses unsupported compression. Save a new DOCX copy in Word.');
  total+=size;if(total>MAX_TOTAL)throw Error('The expanded Word document exceeds 64 MB. Reduce embedded media or split the lesson.');
  if(pos+46+nameLen+extraLen+commentLen>buffer.byteLength)throw Error('The Word archive is damaged.');
  const name=decoder.decode(new Uint8Array(buffer,pos+46,nameLen));sizes.set(name,size);pos+=46+nameLen+extraLen+commentLen;
 }
 if((sizes.get('word/document.xml')||0)>8*1024*1024)throw Error('The document text is too large. Split it into smaller lessons.');
 return sizes;
}
function xml(text){if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('This document contains unsupported XML declarations.');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('The document contains unreadable XML. Save another DOCX copy in Word.');return doc}
function textOf(el){const paragraphs=el.namespaceURI===WORD&&el.localName==='p'?[el]:Array.from(el.getElementsByTagNameNS(WORD,'p'));if(!paragraphs.length)return '';return paragraphs.map(p=>{let out='';const walk=n=>{for(const child of n.childNodes){if(child.nodeType!==1)continue;if(child.namespaceURI===WORD&&child.localName==='t')out+=child.textContent;else if(child.namespaceURI===WORD&&child.localName==='tab')out+='\t';else if(child.namespaceURI===WORD&&['br','cr'].includes(child.localName))out+='\n';else walk(child)}};walk(p);return out}).join('\n')}
function normalizeTarget(target){let path=target.startsWith('/')?target.slice(1):'word/'+target;let stack=[];for(const s of path.split('/')){if(s==='..')stack.pop();else if(s&&s!=='.')stack.push(s)}return stack.join('/')}
async function readDocx(file){
 if(!/\.docx$/i.test(file.name))throw Error('Choose a .docx Word document. Older .doc, PDF and PowerPoint files are not supported.');
 if(file.size>15*1024*1024)throw Error('Choose a Word file up to 15 MB. Split large storyboards into lessons.');
 const buffer=await file.arrayBuffer(),sizes=preflight(buffer);let zip;
 try{zip=await root.JSZip.loadAsync(buffer)}catch{throw Error('This Word file could not be opened. Save another DOCX copy in Word.')}
 const documentPart=zip.file('word/document.xml');if(!documentPart)throw Error('This is not a valid Word .docx document.');
 const documentXml=xml(await documentPart.async('string')),body=documentXml.getElementsByTagNameNS(WORD,'body')[0];if(!body)throw Error('No Word document body was found.');
 let rels=new Map(),relPart=zip.file('word/_rels/document.xml.rels');if(relPart){const relXml=xml(await relPart.async('string'));for(const rel of relXml.getElementsByTagName('Relationship'))rels.set(rel.getAttribute('Id'),{target:rel.getAttribute('Target'),external:rel.getAttribute('TargetMode')==='External'})}
 let cache=new Map(),embeddedTotal=0;
 async function imageFor(id,alt){
  if(cache.has(id))return {...cache.get(id),alt};const rel=rels.get(id);let result={key:id,alt};
  if(!rel||rel.external){result.warning='A linked image was not embedded in Word. Attach the image manually.';return result}
  const path=normalizeTarget(rel.target),name=path.split('/').pop();result.name=name;const entry=zip.file(path),size=sizes.get(path)||0;
  const ext=name.split('.').pop().toLowerCase(),mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'}[ext];
  if(!entry||!path.startsWith('word/media/'))result.warning=`${name}: embedded media could not be located.`;
  else if(!mime)result.warning=`${name}: this image format is not supported. Reattach a PNG, JPEG, WebP or GIF.`;
  else if(size>MAX_IMAGE)result.warning=`${name}: image is larger than 2 MB and was not attached.`;
  else if(embeddedTotal+size>6*1024*1024)result.warning=`${name}: image attachments exceeded the 6 MB Word import allowance. Attach it manually.`;
  else{embeddedTotal+=size;result.data=`data:${mime};base64,${await entry.async('base64')}`}
  cache.set(id,result);return result;
 }
 async function imagesOf(el){let out=[];for(const blip of el.getElementsByTagNameNS('*','blip')){const embed=blip.getAttributeNS(REL,'embed'),linked=blip.getAttributeNS(REL,'link');const id=embed||linked;if(!id)continue;let container=blip;while(container.parentElement&&container.localName!=='drawing')container=container.parentElement;const props=container.getElementsByTagNameNS('*','docPr')[0],alt=props?.getAttribute('descr')||props?.getAttribute('title')||'';out.push(await imageFor(id,alt))}for(const legacy of el.getElementsByTagNameNS('*','imagedata')){const id=legacy.getAttributeNS(REL,'id');if(id)out.push(await imageFor(id,''))}return out}
 let entries=[];for(const child of body.children){if(child.namespaceURI!==WORD)continue;if(child.localName==='p'){const style=child.getElementsByTagNameNS(WORD,'pStyle')[0]?.getAttributeNS(WORD,'val')||'';entries.push({kind:'paragraph',text:textOf(child),heading:style,images:await imagesOf(child)})}else if(child.localName==='tbl'){let rows=[];for(const row of child.children){if(row.localName!=='tr')continue;let cells=[];for(const cell of row.children){if(cell.localName!=='tc')continue;cells.push({text:textOf(cell),images:await imagesOf(cell),nested:cell.getElementsByTagNameNS(WORD,'tbl').length>0})}rows.push({cells})}entries.push({kind:'table',rows})}}
 return parseEntries(entries,file.name);
}
root.ShelfWord={readDocx,parseEntries,isPlaceholder,preflight};
})(typeof window!=='undefined'?window:globalThis);
