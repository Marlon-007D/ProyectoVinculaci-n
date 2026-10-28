import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { MenuNode } from "../../types/menu";
import { MenuLink, MenuLinkContent } from "./MenuLink";
import { NavigationIcon } from "./NavigationIcon";
import { withSimulatorChoices } from "./Navigation";

function MobileItem({ node, close }: { node: MenuNode; close: () => void }) {
  const [open, setOpen] = useState(false);
  const subId = useId();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const learningActive = node.label === "Aprendizaje" && (params.get("courses") === "1" || params.has("simulator") || params.get("slug") === "simuladores");
  if (node.children.length === 0)
    return (
      <li>
        <MenuLink node={node} className="site-mnav__link" onClick={close} leadingIcon={<NavigationIcon label={node.label} />} />
      </li>
    );
  return (
    <li>
      <button type="button" className="site-mnav__link site-mnav__toggle" aria-expanded={open} aria-controls={subId} aria-current={learningActive ? "page" : undefined} onClick={() => setOpen((o) => !o)}>
        <MenuLinkContent><NavigationIcon label={node.label} /><span>{node.label}</span></MenuLinkContent>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <ul id={subId} className="site-mnav__sub" hidden={!open}>
        {node.children.map((c) => (
          <MobileItem key={c.menu_id} node={c} close={close} />
        ))}
      </ul>
    </li>
  );
}

export function MobileNavigation({ tree, loginUrl }: { tree: MenuNode[]; loginUrl?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="site-mnav">
      <button ref={btnRef} type="button" className="site-mnav__button" aria-label={open ? "Cerrar navegación" : "Abrir navegación"} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <span className="site-mnav__icon material-symbols-rounded" aria-hidden="true">menu</span>
      </button>
      <nav id={panelId} className="site-mnav__panel" aria-label="Principal (móvil)" hidden={!open}>
        <ul className="site-mnav__list">
          {tree.map((item) => {
            const node = withSimulatorChoices(item);
            return <MobileItem key={node.menu_id} node={node} close={() => setOpen(false)} />;
          })}
          {loginUrl && <li>
            <Link to={loginUrl} className="site-mnav__link" onClick={() => setOpen(false)}>
              <MenuLinkContent><NavigationIcon label="Iniciar sesión" /><span>Iniciar sesión</span></MenuLinkContent>
            </Link>
          </li>}
        </ul>
      </nav>
    </div>
  );
}
