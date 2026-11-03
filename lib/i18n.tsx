'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import dictionary from './en-ui.json';
export type Locale='zh'|'en';
import {brand} from './brand';
export {brand} from './brand';
const LocaleContext=createContext<{locale:Locale;setLocale:(value:Locale)=>void}>({locale:'zh',setLocale:()=>{}});
export function LocaleProvider({children}:{children:React.ReactNode}){
  const [locale,setLocale]=useState<Locale>('zh');
  useEffect(()=>{try{const param=new URLSearchParams(window.location.search).get('lang');if(param==='en'||(!param&&localStorage.getItem('hvrp-language')==='en'))setLocale('en');}catch{}},[]);
  useEffect(()=>{document.documentElement.lang=locale==='zh'?'zh-CN':'en';document.title=locale==='zh'?brand.zh:brand.en+' – '+brand.full;try{localStorage.setItem('hvrp-language',locale);}catch{}},[locale]);
  const chooseLocale=(value:Locale)=>{setLocale(value);const url=new URL(window.location.href);url.searchParams.set('lang',value);window.history.replaceState(null,'',url);};
  return <LocaleContext.Provider value={{locale,setLocale:chooseLocale}}>{children}</LocaleContext.Provider>;
}
export const useLocale=()=>useContext(LocaleContext);
export function translateUI(value:string,locale:Locale):string{
  if(locale==='zh'||!/[\u3400-\u9fff]/.test(value))return value;
  const all=dictionary as Record<string,string>,clean=value.trim();
  if(all[clean]!==undefined)return value.replace(clean,all[clean]);
  // Only known UI templates are interpolated. Source prose is never translated piecemeal.
  const templates:[RegExp,(m:RegExpMatchArray)=>string][]=[
    [/^(年代|材料|结构|保存状态) · (.+)$/,m=>(all[m[1]]??m[1])+' · '+m[2]],
    [/^第\s*(\d+)\s*行$/,m=>'Row '+m[1]],
    [/^(\d+) 项待补充$/,m=>m[1]+' missing items'],
    [/^当前缩放 (\d+) 级$/,m=>'Zoom '+m[1]],
    [/^查看(.+)$/,m=>'Open '+m[1]],
    [/^(文物|建筑轮廓|行政区|保护等级|文物类型|档案属性|评价指标|评价维度|来源文件)：(.+)$/,m=>(all[m[1]]??m[1])+': '+translateUI(m[2],locale)],
    [/^(.+)的直接关联$/,m=>'Direct connections to '+translateUI(m[1],locale)],
    [/^(.+) · (\d+) 条直接关系(.*)$/,m=>translateUI(m[1],locale)+' · '+m[2]+' direct connections'+m[3]],
  ];
  for(const [pattern,format] of templates){const match=clean.match(pattern);if(match)return format(match);}
  return value;
}
const uiProps=['title','subtitle','label','unit','placeholder','aria-label','alt'];
function translateTree(node:React.ReactNode,locale:Locale):React.ReactNode{
  if(typeof node==='string')return translateUI(node,locale);
  if(Array.isArray(node))return React.Children.map(node,child=>translateTree(child,locale));
  if(!React.isValidElement(node))return node;
  const props=node.props as Record<string,any>;
  if(props['data-original']||props.translate==='no')return node;
  const next:Record<string,any>={};
  for(const key of uiProps)if(typeof props[key]==='string')next[key]=translateUI(props[key],locale);
  // Changing an option's display language must never change its database value.
  if(node.type==='option'&&props.value===undefined&&typeof props.children==='string')next.value=props.children;
  if(props.children!==undefined)next.children=translateTree(props.children,locale);
  return React.cloneElement(node,next);
}
export function Localized({children}:{children:React.ReactNode}){const {locale}=useLocale();return <>{translateTree(children,locale)}</>;}
export function LanguageSwitch(){const {locale,setLocale}=useLocale();return <div className="language-switch" role="group" aria-label="Language / 语言"><button lang="zh-CN" aria-pressed={locale==='zh'} onClick={()=>setLocale('zh')}>中文</button><span>/</span><button lang="en" aria-pressed={locale==='en'} onClick={()=>setLocale('en')}>EN</button></div>;}
