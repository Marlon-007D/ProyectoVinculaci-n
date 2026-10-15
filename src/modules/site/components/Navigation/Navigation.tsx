import { useEffect, useId, useRef, useState } from "react";
import type { MenuNode } from "../../types/menu";
import { MenuLink } from "./MenuLink";

function NavItem({ node }: { node: MenuNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const subId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      if (ref.current && !ref.current.contains(e.relatedTarget as Node | null)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    const el = ref.current;
    el?.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      el?.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);

  if (node.children.length === 0)
    return (
      <li className="site-nav__item">
        <MenuLink node={node} className="site-nav__link" />
      </li>
    );

  return (
    <li className="site-nav__item site-nav__item--parent" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className="site-nav__link site-nav__toggle"
        aria-expanded={open}
        aria-controls={subId}
        onClick={() => setOpen((o) => !o)}
      >
        {node.label}
        <span aria-hidden="true" className="site-nav__caret">▾</span>
      </button>
      <ul id={subId} className="site-nav__sub" hidden={!open}>
        {node.children.map((c) => (
          <NavItem key={c.menu_id} node={c} />
        ))}
      </ul>
    </li>
  );
}

export function Navigation({ tree }: { tree: MenuNode[] }) {
  return (
    <nav className="site-nav" aria-label="Principal">
      <ul className="site-nav__list">
        {tree.map((n) => (
          <NavItem key={n.menu_id} node={n} />
        ))}
      </ul>
    </nav>
  );
}
