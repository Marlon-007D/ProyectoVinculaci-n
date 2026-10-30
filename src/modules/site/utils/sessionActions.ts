export type SessionAction =
  | { kind: 'login'; label: string; to: string }
  | { kind: 'panel'; label: string; to: string }
  | { kind: 'logout'; label: string };

/** Header actions of the public portal: signed out offers login; signed in offers the panel and sign-out. */
export function publicSessionActions(signedIn: boolean, institution?: { institution_id: string; slug: string }): SessionAction[] {
  if (!institution) return [];
  const id = encodeURIComponent(institution.institution_id);
  if (!signedIn) return [{ kind: 'login', label: 'Iniciar sesión', to: `/${institution.slug}/login?institution=${id}` }];
  return [
    { kind: 'panel', label: 'Ir al panel', to: `/panel?institution=${id}&slug=${encodeURIComponent(institution.slug)}` },
    { kind: 'logout', label: 'Salir' },
  ];
}
