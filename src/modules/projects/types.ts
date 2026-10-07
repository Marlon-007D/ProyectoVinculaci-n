export interface Project {
  id: string;
  institution_id: string;
  name: string;
  description: string;
  budget_total: number;
  is_active: boolean;
  start_date: string;
  end_date: string;
  created_at?: string;
  updated_at?: string;
}
