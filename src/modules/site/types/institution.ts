export interface Institution {
  institution_id: string;
  name: string;
  slug: string;
  domain: string | null;
  is_active: boolean;
}
