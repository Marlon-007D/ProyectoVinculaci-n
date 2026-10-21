import styles from './portal.module.css';
export const moduleClass=(value?:string)=>(value??'').split(/\s+/).map(name=>styles[name]??name).join(' ');
