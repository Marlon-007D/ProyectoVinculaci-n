import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {AccessState,Institution,ModuleAccessPort} from './moduleTypes';
export type {Institution} from './moduleTypes';

interface Context {
  state:AccessState;busy:boolean;message:string;activeInstitution:Institution|null;institutions:Institution[];
  setActiveInstitution:(institution:Institution|null)=>void;
  login:(email:string,password:string)=>Promise<void>;verify:(code:string)=>Promise<void>;
  logout:()=>Promise<void>;reload:()=>void;
}
const Session=createContext<Context|null>(null);
export function ModuleSessionProvider({port,children}:{port:ModuleAccessPort;children:ReactNode}){
  const [state,setState]=useState<AccessState>({kind:'checking'});
  const [selected,setSelected]=useState<{owner:string;institution:string}|null>(null);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const generation=useRef(0);const mounted=useRef(false);const lock=useRef(false);
  const reload=useCallback(()=>{
    const id=++generation.current;setState({kind:'checking'});setMessage('');
    // Auth event callbacks must finish before requesting another Supabase auth lock.
    void Promise.resolve().then(()=>port.check()).then(result=>{
      if(mounted.current&&generation.current===id)setState(result);
    }).catch(()=>{if(mounted.current&&generation.current===id)setState({kind:'unavailable',message:'No se pudo verificar el acceso institucional. Reintenta; si persiste, solicita que revisen tu cuenta y la configuración del módulo.'});});
  },[port]);
  useEffect(()=>{mounted.current=true;const unsubscribe=port.subscribe(reload);reload();const pending=generation;return()=>{mounted.current=false;pending.current++;unsubscribe();};},[port,reload]);
  async function act(action:()=>Promise<void>){
    if(lock.current)return;lock.current=true;setBusy(true);setMessage('');
    try{await action();if(mounted.current)reload();}
    catch{if(mounted.current)setMessage('No se pudo completar el acceso. Revisa los datos y vuelve a intentarlo.');}
    finally{lock.current=false;if(mounted.current)setBusy(false);}
  }
  const institutions=state.kind==='ready'?state.institutions:[];
  const activeInstitution=institutions.find(item=>state.kind==='ready'&&selected?.owner===state.userId&&item.institution_id===selected.institution)??institutions[0]??null;
  return <Session.Provider value={{state,busy,message,institutions,activeInstitution,
    setActiveInstitution:institution=>{if(state.kind==='ready')setSelected(institution?{owner:state.userId,institution:institution.institution_id}:null);},
    reload,login:(email,password)=>act(()=>port.login(email,password)),
    verify:code=>state.kind==='mfa'?act(()=>port.verify(state.factorId,code)):Promise.resolve(),
    logout:()=>act(()=>port.logout()),
  }}>{children}</Session.Provider>;
}
export function useTenant(){const value=useContext(Session);if(!value)throw new Error('Falta el proveedor de acceso del módulo.');return value;}
