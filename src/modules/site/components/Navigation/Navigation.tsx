import { useEffect, useId, useRef, useState } from "react";
import type { MenuNode } from "../../types/menu";
import { useLocation } from "react-router-dom";
import { MenuLink } from "./MenuLink";
import { NavigationIcon } from "./NavigationIcon";
import { SessionActions } from "./SessionActions";

export function withSimulatorChoices(node: MenuNode): MenuNode {
  if (node.label.trim().toLocaleLowerCase("es") !== "simuladores") return node;
  const simulatorLink: MenuNode = { ...node, menu_id: `${node.menu_id}-simulators-link`, parent_id: node.menu_id, children: [], depth: node.depth + 1, label: "Simuladores" };
  const coursesLink: MenuNode = { ...node, menu_id: `${node.menu_id}-courses-link`, parent_id: node.menu_id, children: [], depth: node.depth + 1, label: "Cursos", url: "/?courses=1", position: 0 };
  return { ...node, label: "Aprendizaje", url: "#", children: [coursesLink, simulatorLink, ...node.children] };
}

export function withHonorChoice(node: MenuNode): MenuNode {
  if (node.label.trim().toLocaleLowerCase("es") !== "institución") return node;
  const honorLink: MenuNode = {
    ...node,
    menu_id: `${node.menu_id}-honors-link`,
    parent_id: node.menu_id,
    children: [],
    depth: node.depth + 1,
    label: "Cuadro de honor",
    url: "/?honores=1",
    position: node.children.length,
    is_external: false,
  };
  return { ...node, children: [...node.children, honorLink] };
}

function NavItem({ node }: { node: MenuNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const subId = useId();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const learningActive = node.label === "Aprendizaje" && (params.get("courses") === "1" || params.has("simulator") || params.get("slug") === "simuladores");

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
        <MenuLink node={node} className="site-nav__link" leadingIcon={<NavigationIcon label={node.label} />} />
      </li>
    );

  return (
    <li className="site-nav__item site-nav__item--parent" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className="site-nav__link site-nav__toggle"
        aria-expanded={open}
        aria-current={learningActive ? "page" : undefined}
        aria-controls={subId}
        onClick={() => setOpen((o) => !o)}
      >
        <NavigationIcon label={node.label} />
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
        {tree.map((item) => {
          const node = withHonorChoice(withSimulatorChoices(item));
          return <NavItem key={node.menu_id} node={node} />;
        })}
        <SessionActions variant="desktop" />
      </ul>
    </nav>
  );
}
