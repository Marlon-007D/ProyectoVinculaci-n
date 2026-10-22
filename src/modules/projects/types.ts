export interface ProjectMember {
  project_member_id: string;
  project_id: string;
  profile_id: string;
  full_name: string;
  email: string;
  role: string;
}
export interface Expense { expense_id: string; budget_item_id: string; amount: number; description: string; date: string }
export interface BudgetItem { budget_item_id: string; project_id: string; name: string; allocated_amount: number; spent_amount: number; expenses: Expense[] }
export interface Project {
  id: string; institution_id: string; name: string; description: string; budget_total: number;
  is_active: boolean; is_public: boolean; start_date: string; end_date: string; created_at?: string; updated_at?: string;
  budget_items: BudgetItem[]; members: ProjectMember[];
}
export interface MemberOption { profile_id: string; full_name: string; email: string }
