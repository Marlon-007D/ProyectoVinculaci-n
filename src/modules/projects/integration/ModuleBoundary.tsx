import {Component,type ReactNode} from 'react';
import styles from './ModuleBoundary.module.css';
export class ModuleBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<main className={styles.notice}><h1>No se pudo abrir el módulo</h1><p>Reintenta la carga. Si el problema continúa, solicita que revisen su configuración.</p><button onClick={()=>window.location.reload()}>Reintentar</button><a href="/">Volver al portal</a></main>:this.props.children;}
}
