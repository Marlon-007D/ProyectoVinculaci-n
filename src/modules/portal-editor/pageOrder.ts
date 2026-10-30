interface OrderablePage { status: string; snapshot: { title: string; is_homepage: boolean } }

/** Logical order for the page picker: the homepage, then published pages, then drafts; alphabetical inside each group. */
export function orderPortalPages<T extends OrderablePage>(pages: readonly T[]): T[] {
  const rank = (page: T) => (page.snapshot.is_homepage ? 0 : page.status === 'published' ? 1 : 2);
  return [...pages].sort((a, b) => rank(a) - rank(b) || a.snapshot.title.localeCompare(b.snapshot.title, 'es'));
}
