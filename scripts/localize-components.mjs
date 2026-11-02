// One-time source migration helper: wraps component output, not data or state values.
import ts from 'typescript';
import fs from 'node:fs';
for(const filename of ['app/workbench.tsx','app/knowledge-graph.tsx','app/heritage-map.tsx']){
 let source=fs.readFileSync(filename,'utf8');const file=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
 function visit(node){if(ts.isReturnStatement(node)&&node.expression&&(ts.isJsxElement(node.expression)||ts.isJsxSelfClosingElement(node.expression)||ts.isJsxFragment(node.expression))){let p=node.parent;while(p&&!ts.isFunctionLike(p))p=p.parent;if(p&&ts.isFunctionDeclaration(p)){edits.push({start:node.expression.getStart(file),end:node.expression.end});}}ts.forEachChild(node,visit);}visit(file);
 for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+'<Localized>'+source.slice(e.start,e.end)+'</Localized>'+source.slice(e.end);
 source=source.replace("'use client';","'use client';\nimport { Localized, LocaleProvider, LanguageSwitch, useLocale, translateUI, brand } from '../lib/i18n';");
 if(filename==='app/workbench.tsx'){source=source.replace('export default function Workbench(){','export default function Workbench(){return <LocaleProvider><WorkbenchContent/></LocaleProvider>;}\nfunction WorkbenchContent(){\n  const {locale}=useLocale();');}
 fs.writeFileSync(filename,source);
}
