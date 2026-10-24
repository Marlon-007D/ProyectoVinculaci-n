import { readSessionValue, writeSessionValue } from './sessionStorage.ts';
import type { AccessScope } from './accessPolicy.ts';

export function adminDestination(path: string, search: string, selected?: AccessScope): string {
  const destination = new URL(path, 'https://admin.invalid');
  const params = new URLSearchParams(search);
  const context = currentAdminScope(search);
  if (context.institution) params.set('institution', context.institution);
  if (context.slug) params.set('slug', context.slug);
  destination.searchParams.forEach((value, key) => params.set(key, value));
  if (selected) {
    params.delete('institution');
    params.delete('slug');
    if (selected.institution) params.set('institution', selected.institution);
    if (selected.slug) params.set('slug', selected.slug);
  }
  return destination.pathname + (params.size ? '?' + params.toString() : '') + destination.hash;
}

export function currentAdminScope(search: string): AccessScope {
  const params = new URLSearchParams(search);
  const explicit = params.has('institution') || params.has('slug');
  const context = { institution: params.get('institution') || undefined, slug: params.get('slug') || undefined };
  if (explicit) {
    writeSessionValue('panel-institution-context', JSON.stringify(context));
    return context;
  }
  try {
    const stored: unknown = JSON.parse(readSessionValue('panel-institution-context') || '{}');
    if (stored && typeof stored === 'object') return {
      institution: 'institution' in stored && typeof stored.institution === 'string' ? stored.institution : undefined,
      slug: 'slug' in stored && typeof stored.slug === 'string' ? stored.slug : undefined,
    };
  } catch { return context; }
  return context;
}
