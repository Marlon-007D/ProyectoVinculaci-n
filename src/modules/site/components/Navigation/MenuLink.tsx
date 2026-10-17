import { Link, useLocation } from "react-router-dom";
import { useInstitution } from "../../context/InstitutionContext";
import type { MenuNode } from "../../types/menu";
import { joinBase } from "../../utils/basePath";
import { isSafeExternalUrl, keepInstitution } from "../../utils/url";

interface Props {
  node: MenuNode;
  className?: string;
  onClick?: () => void;
}

const trim = (p: string) => p.replace(/\/+$/, "") || "/";

export function MenuLink({ node, className, onClick }: Props) {
  const { basePath } = useInstitution();
  const location = useLocation();
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
  const to = joinBase(basePath, node.url);
  const target = new URL(to, "http://x");
  const sameSlug =
    (target.searchParams.get("slug") ?? "") === (new URLSearchParams(location.search).get("slug") ?? "");
  const here = trim(location.pathname);
  const there = trim(target.pathname);
  const samePath = there === "/" ? here === "/" : here === there || here.startsWith(there + "/");
  return (
    <Link to={keepInstitution(to, location.search)} className={className} onClick={onClick} aria-current={samePath && sameSlug ? "page" : undefined}>
      {node.label}
    </Link>
  );
}
