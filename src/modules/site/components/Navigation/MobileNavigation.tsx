import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { MenuNode } from "../../types/menu";
import { MenuLink } from "./MenuLink";

function MobileItem({ node, close }: { node: MenuNode; close: () => void }) {
  const [open, setOpen] = useState(false);
  const subId = useId();
  if (node.children.length === 0)
    return (
      <li>
        <MenuLink node={node} className="site-mnav__link" onClick={close} />
      </li>
    );
  return (
    <li>
      <button type="button" className="site-mnav__link site-mnav__toggle" aria-expanded={open} aria-controls={subId} onClick={() => setOpen((o) => !o)}>
        {node.label}
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

export function MobileNavigation({ tree }: { tree: MenuNode[] }) {
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
      <button ref={btnRef} type="button" className="site-mnav__button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <span className="site-mnav__icon" aria-hidden="true" />
        <span>{open ? "Cerrar menú" : "Menú"}</span>
      </button>
      <nav id={panelId} className="site-mnav__panel" aria-label="Principal (móvil)" hidden={!open}>
        <ul className="site-mnav__list">
          {tree.map((n) => (
            <MobileItem key={n.menu_id} node={n} close={() => setOpen(false)} />
          ))}
        </ul>
      </nav>
    </div>
  );
}
