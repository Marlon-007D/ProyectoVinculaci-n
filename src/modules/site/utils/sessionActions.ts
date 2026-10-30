export type SessionAction =
  | { kind: 'login'; label: string; to: string }
  | { kind: 'logout'; label: string };

/** Header action of the public portal: login without a session, sign-out with one. */
export function publicSessionActions(signedIn: boolean, institution?: { institution_id: string; slug: string }): SessionAction[] {
  if (!institution) return [];
  const id = encodeURIComponent(institution.institution_id);
  if (!signedIn) return [{ kind: 'login', label: 'Iniciar sesión', to: `/${institution.slug}/login?institution=${id}` }];
  return [{ kind: 'logout', label: 'Salir' }];
}
