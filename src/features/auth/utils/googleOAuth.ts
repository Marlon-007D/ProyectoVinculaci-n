export interface InstitutionContext {
  institution?: string;
  slug?: string;
}

export function institutionContextFromSearch(search: string): InstitutionContext {
  const params = new URLSearchParams(search);
  return { institution: params.get('institution') || undefined, slug: params.get('slug') || undefined };
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
