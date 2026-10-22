import type { MenuNode } from "../../types/menu";
import type { SiteConfig } from "../../types/site";
import { MenuLink } from "./MenuLink";
import { withHonorChoice, withSimulatorChoices } from "./Navigation";
import styles from "./PublicSidebar.module.css";

const ICONS: Record<string, string> = {
  institucion: "account_balance", nosotros: "info", "oferta educativa": "menu_book",
  transparencia: "policy", dece: "health_and_safety",
  inicio: "home", "página principal": "home", "pagina principal": "home", principal: "home",
  noticias: "campaign", eventos: "event", cursos: "menu_book", simuladores: "calculate",
  aprendizaje: "school", "cuadro de honor": "workspace_premium", contacto: "mail", "sobre nosotros": "info",
};

const TONES: Record<string, string> = {
  inicio: "home", "página principal": "home", "pagina principal": "home", principal: "home",
  institución: "institutions", institucion: "institutions", nosotros: "institutions", noticias: "news",
  eventos: "news", contacto: "contact", aprendizaje: "learning", cursos: "learning", simuladores: "learning",
  transparencia: "projects", dece: "dece", "cuadro de honor": "honors",
};

function iconFor(label: string): string {
  const normalized = label.trim().toLocaleLowerCase("es");
  return ICONS[normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ?? "article";
}

function toneFor(label: string): string {
  return TONES[label.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ?? "default";
}

function SidebarItems({ tree, nested = false }: { tree: MenuNode[]; nested?: boolean }) {
  return <ul className={nested ? styles.sublist : styles.list}>
    {tree.map((node) => <li key={node.menu_id}>
      <div className={styles.subitem}>
        <span className={styles.subicon} data-tone={toneFor(node.label)} aria-hidden="true">{iconFor(node.label)}</span>
        <MenuLink node={node} className={styles.link} />
      </div>
      {node.children.length > 0 && <SidebarItems tree={node.children} nested />}
    </li>)}
  </ul>;
}

export function PublicSidebar({ tree, config }: { tree: MenuNode[]; config: SiteConfig }) {
  return <aside className={styles.sidebar} aria-label="Navegación del portal">
    <div className={styles.brand}>
      {config.logoUrl ? <img src={config.logoUrl} alt="" className={styles.logo} /> : <span className={styles.logoFallback} aria-hidden="true">{config.name.trim().charAt(0).toUpperCase()}</span>}
      <div className={styles.brandText}><strong>{config.name}</strong><span>Portal institucional</span></div>
    </div>
    <p className={styles.caption}>Explorar</p>
    <nav aria-label="Secciones del portal">
      <ul className={styles.list}>
        {tree.map((raw) => {
          const simulatorNode = withSimulatorChoices(raw);
          const node = withHonorChoice(simulatorNode.label === "Aprendizaje" ? { ...simulatorNode, url: "/" } : simulatorNode);
          return <li key={node.menu_id}>
            <div className={styles.item}>
              <span className={styles.icon} data-tone={toneFor(node.label)} aria-hidden="true">{iconFor(node.label)}</span>
              <MenuLink node={node} className={styles.link} />
            </div>
            {node.children.length > 0 && <SidebarItems tree={node.children} nested />}
          </li>;
        })}
      </ul>
    </nav>
    <div className={styles.note}>
      <span className={styles.noteIcon} aria-hidden="true">school</span>
      <strong>Información institucional</strong>
      <p>Consulta las secciones y recursos disponibles de {config.name}.</p>
    </div>
  </aside>;
}
