import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
export const uploadLimit=10*1024*1024;
export const uploadExtensions=['xlsx','csv','txt','md','json','docx','pdf'];
const textLimit=60000;
const array=(value:any):any[]=>value===undefined?[]:Array.isArray(value)?value:[value];
const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false,processEntities:false});
function xml(source:string){if(/<!DOCTYPE|<!ENTITY/i.test(source))throw Error('不支持包含外部实体的文档。');return parser.parse(source);}
function decode(value:string){return value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');}
function textOf(node:any):string{if(node===null||node===undefined)return'';if(typeof node!=='object')return decode(String(node));if(Array.isArray(node))return node.map(textOf).join('');return Object.entries(node).filter(([k])=>!k.startsWith('@_')).map(([,v])=>textOf(v)).join('');}
export function parseCSV(text:string){const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;if(rows.length>20000)throw Error('表格超过20,000行，请分批上传。');}if(quoted)throw Error('CSV 引号未闭合。');if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
export function extractDocument(filename:string,bytes:Uint8Array,suppliedExcerpt=''){
 if(bytes.length===0||bytes.length>uploadLimit)throw Error('文件不能为空且不得超过10MB。');
 const extension=filename.split('.').pop()?.toLowerCase()||'';
 if(!uploadExtensions.includes(extension))throw Error('不支持该文件格式。');
 let content='',locator='',note='';
 if(extension==='pdf'){
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('PDF 文件格式不正确。');
  if(!suppliedExcerpt.trim())throw Error('PDF 请填写可核对的原文摘录和页码；当前未启用 OCR。');
  content=suppliedExcerpt.trim();locator='用户提供的 PDF 摘录（页码见内容）';note='PDF 已归档；摘录由上传者提供，尚待核验，不代表自动识别全文。';
 }else if(extension==='xlsx'||extension==='docx'){
  let total=0;
  const entries=unzipSync(bytes,{filter(file){const include=extension==='docx'?file.name==='word/document.xml':/^xl\/(sharedStrings.xml|workbook.xml|_rels\/workbook.xml.rels|worksheets\/sheet\d+.xml)$/.test(file.name);if(!include)return false;total+=file.originalSize;if(total>20*1024*1024||file.originalSize>12*1024*1024)throw Error('解压后的文档过大，请拆分文件。');return true;}});
  if(extension==='docx'){if(!entries['word/document.xml'])throw Error('DOCX 缺少正文。');const doc=xml(strFromU8(entries['word/document.xml']));content=array(doc['w:document']?.['w:body']?.['w:p']).map((p,i)=>`[段落 ${i+1}] ${textOf(p)}`).join('\n');locator='Word 正文段落';note='提取正文段落；表格、图片和脚注需另行核验。';}
  else{
   if(!entries['xl/workbook.xml'])throw Error('XLSX 缺少工作簿。');
   const shared=entries['xl/sharedStrings.xml']?array(xml(strFromU8(entries['xl/sharedStrings.xml'])).sst?.si).map(textOf):[];
   const workbook=xml(strFromU8(entries['xl/workbook.xml']));const relations=entries['xl/_rels/workbook.xml.rels']?array(xml(strFromU8(entries['xl/_rels/workbook.xml.rels'])).Relationships?.Relationship):[];
   const lines:string[]=[];let rows=0;
   for(const sheet of array(workbook.workbook?.sheets?.sheet)){
    const relation=relations.find(r=>r['@_Id']===sheet['@_r:id']);const target=String(relation?.['@_Target']||'');const sheetPath=target.startsWith('/xl/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');
    if(!/^xl\/worksheets\/sheet\d+.xml$/.test(sheetPath)||!entries[sheetPath])continue;
    const data=xml(strFromU8(entries[sheetPath]));
    for(const row of array(data.worksheet?.sheetData?.row)){if(++rows>20000)throw Error('表格超过20,000行，请分批上传。');const cells=array(row.c).map(c=>{const value=c['@_t']==='s'?shared[Number(c.v)]||'':c['@_t']==='inlineStr'?textOf(c.is):textOf(c.v);return value?`${c['@_r']||''}: ${value}`:'';}).filter(Boolean);if(cells.length)lines.push(`[${decode(String(sheet['@_name']))} · 第 ${row['@_r']||rows} 行] ${cells.join(' | ')}`);}
   }
   content=lines.join('\n');locator='工作表名称、行号与单元格';note='提取单元格保存值；不执行公式、宏或外部链接。';
  }
 }else{
  let raw:string;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');}catch{throw Error('文本文件请使用 UTF-8 编码。');}
  if(extension==='json'){try{JSON.parse(raw);}catch{throw Error('JSON 文件格式不正确。');}}
  content=extension==='csv'?parseCSV(raw).map((r,i)=>`[第 ${i+1} 行] ${r.join(' | ')}`).join('\n'):raw.split(/\r?\n/).map((line,i)=>`[第 ${i+1} 行] ${line}`).join('\n');locator=extension==='csv'?'CSV 原始行号':'文本原始行号';note='保留原始文本，不执行文件中的指令。';
 }
 if(!content.trim())throw Error('未提取到可检索文本，请补充文字资料。');
 const truncated=content.length>textLimit;if(truncated)note+=' 检索预览截取前60,000字符；完整原文件保留。';
 return {content:content.slice(0,textLimit),locator,extraction_note:note,truncated};
}
