export function computeBasePath(pathname: string, splat: string | undefined): string {
  let path = pathname;
  try {
    path = decodeURI(pathname);
  } catch {
    path = pathname;
  }
  const rest = splat ?? "";
  const base = rest && path.endsWith(rest) ? path.slice(0, path.length - rest.length) : path;
  return base.replace(/\/+$/, "");
}

export function joinBase(basePath: string, url: string): string {
  if (url === "/" || url === "") return basePath || "/";
  return `${basePath}${url.startsWith("/") ? url : `/${url}`}`;
}
