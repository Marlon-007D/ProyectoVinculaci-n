export interface InstitutionContext {
  institution?: string;
  slug?: string;
}

export function institutionContextFromSearch(search: string): InstitutionContext {
  const params = new URLSearchParams(search);
  const explicit = params.has('institution') || params.has('slug');
  const context = { institution: params.get('institution') || undefined, slug: params.get('slug') || undefined };
  try {
    if (typeof sessionStorage === 'undefined') return context;
    if (explicit) {
      sessionStorage.setItem('panel-institution-context', JSON.stringify(context));
      return context;
    }
    const stored: unknown = JSON.parse(sessionStorage.getItem('panel-institution-context') || '{}');
    if (stored && typeof stored === 'object') {
      return {
        institution: 'institution' in stored && typeof stored.institution === 'string' ? stored.institution : undefined,
        slug: 'slug' in stored && typeof stored.slug === 'string' ? stored.slug : undefined,
      };
    }
  } catch {
    // URL context remains available when session storage is disabled.
  }
  return context;
}

export function googleOAuthRequest(origin: string, context: InstitutionContext = {}) {
  const redirect = new URL('/panel/admin', origin);
  if (context.institution) redirect.searchParams.set('institution', context.institution);
  if (context.slug) redirect.searchParams.set('slug', context.slug);
  return {
    provider: 'google' as const,
    options: {
      redirectTo: redirect.toString(),
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  };
}

export function matchesInstitution(context: InstitutionContext, institution: { institution_id: string; slug?: string }) {
  return (!context.institution || context.institution === institution.institution_id || context.institution === institution.slug)
    && (!context.slug || context.slug === institution.slug);
}

export function institutionSearch(search: string): string {
  const params = new URLSearchParams(search);
  const context = institutionContextFromSearch(search);
  if (context.institution) params.set('institution', context.institution);
  if (context.slug) params.set('slug', context.slug);
  return params.size ? '?' + params.toString() : '';
}
