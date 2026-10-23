import styles from "./NavigationIcon.module.css";

const ICONS: Record<string, string> = {
  inicio: "home",
  "pagina principal": "home",
  institucion: "account_balance",
  nosotros: "info",
  "sobre nosotros": "info",
  "oferta educativa": "menu_book",
  noticias: "campaign",
  eventos: "event",
  contacto: "mail",
  aprendizaje: "school",
  cursos: "menu_book",
  simuladores: "calculate",
  transparencia: "policy",
  dece: "health_and_safety",
  "iniciar sesion": "login",
  "cuadro de honor": "workspace_premium",
};

function normalize(label: string) {
  return label.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function NavigationIcon({ label }: { label: string }) {
  return <span className={styles.icon} aria-hidden="true">{ICONS[normalize(label)] ?? "article"}</span>;
}
