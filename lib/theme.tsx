'use client';
import {createContext,useContext,useEffect,useState} from 'react';
export type Theme='light'|'dark';
const Context=createContext<{theme:Theme;toggle:()=>void}>({theme:'light',toggle:()=>{}});
export function ThemeProvider({children}:{children:React.ReactNode}){
 const [theme,setTheme]=useState<Theme>('light');
 useEffect(()=>{try{if(localStorage.getItem('herisk-theme')==='dark')setTheme('dark');}catch{}},[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;try{localStorage.setItem('herisk-theme',theme);}catch{}},[theme]);
 return <Context.Provider value={{theme,toggle:()=>setTheme(v=>v==='light'?'dark':'light')}}>{children}</Context.Provider>;
}
export const useTheme=()=>useContext(Context);
