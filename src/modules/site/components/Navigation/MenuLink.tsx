import { NavLink } from "react-router-dom";
import type { MenuNode } from "../../types/menu";
import { isSafeExternalUrl } from "../../utils/url";

interface Props {
  node: MenuNode;
  className?: string;
  onClick?: () => void;
}

export function MenuLink({ node, className, onClick }: Props) {
  if (node.is_external) {
    if (!isSafeExternalUrl(node.url)) return <span className={className} aria-disabled="true">{node.label}</span>;
    return (
      <a className={className} href={node.url} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        {node.label}
        <span className="site-sr-only"> (se abre en una pestaña nueva)</span>
        <span aria-hidden="true" className="site-extmark">↗</span>
      </a>
    );
  }
  return (
    <NavLink to={node.url} end={node.url === "/"} className={className} onClick={onClick}>
      {node.label}
    </NavLink>
  );
}
