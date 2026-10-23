import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useInstitution } from "../../context/InstitutionContext";
import type { MenuNode } from "../../types/menu";
import { joinBase } from "../../utils/basePath";
import { isSafeExternalUrl, keepInstitution } from "../../utils/url";
import styles from "./MenuLink.module.css";

interface Props {
  node: MenuNode;
  className?: string;
  onClick?: () => void;
  collapsed?: boolean;
  leadingIcon?: ReactNode;
}

const trim = (p: string) => p.replace(/\/+$/, "") || "/";

export function MenuLinkContent({ children }: { children: ReactNode }) {
  return <span className={styles.content}>{children}</span>;
}

export function MenuLink({ node, className, onClick, collapsed = false, leadingIcon }: Props) {
  const { basePath } = useInstitution();
  const location = useLocation();
  const label = leadingIcon ? <MenuLinkContent>{leadingIcon}<span>{node.label}</span></MenuLinkContent> : node.label;
  if (node.is_external) {
    if (!isSafeExternalUrl(node.url)) return <span className={className} aria-disabled="true">{label}</span>;
    return (
      <a className={className} href={node.url} target="_blank" rel="noopener noreferrer" onClick={onClick} aria-label={collapsed ? node.label : undefined} title={collapsed ? node.label : undefined}>
        {label}
        <span className="site-sr-only"> (se abre en una pestaña nueva)</span>
        <span aria-hidden="true" className="site-extmark">↗</span>
      </a>
    );
  }
  const to = joinBase(basePath, node.url);
  const target = new URL(to, "http://x");
  const currentParams = new URLSearchParams(location.search);
  const sameRouteQuery = ["slug", "courses", "simulator"].every(
    (key) => (target.searchParams.get(key) ?? "") === (currentParams.get(key) ?? ""),
  );
  const here = trim(location.pathname);
  const there = trim(target.pathname);
  const samePath = there === "/" ? here === "/" : here === there || here.startsWith(there + "/");
  return (
    <Link to={keepInstitution(to, location.search)} className={className} onClick={onClick} aria-current={samePath && sameRouteQuery ? "page" : undefined} aria-label={collapsed ? node.label : undefined} title={collapsed ? node.label : undefined}>
      {label}
    </Link>
  );
}
