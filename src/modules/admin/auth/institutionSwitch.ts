/** Search string after choosing another institution: both parameters name it, so a stale slug cannot override the choice. */
export function institutionSwitchSearch(search: string, next: { institution_id: string; slug: string }): string {
  const params = new URLSearchParams(search);
  params.set('institution', next.institution_id);
  params.set('slug', next.slug);
  return '?' + params.toString();
}
