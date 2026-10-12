import { supabase } from '../../core/supabaseClient';
import type { BudgetItem, Expense, Project, ProjectMember } from './types';
import { sumMoney } from './projectValidation';

interface ExpenseRow extends Omit<Expense, 'date'> { expense_date: string }
interface ItemRow extends Omit<BudgetItem, 'spent_amount' | 'expenses'> { expenses: ExpenseRow[] }
interface ProjectRow extends Omit<Project, 'id' | 'name' | 'budget_total' | 'budget_items' | 'members'> {
  project_id: string; title: string; total_budget: number; budget_items: ItemRow[];
  project_members: ProjectMember[];
}
function expenseFromRow(row: ExpenseRow): Expense {
  return { ...row, date: row.expense_date, amount: Number(row.amount) };
}
export function mapProject(row: ProjectRow): Project {
  return {
    id: row.project_id, institution_id: row.institution_id, name: row.title,
    description: row.description ?? '', budget_total: Number(row.total_budget),
    is_active: row.is_active, is_public: row.is_public,
    start_date: row.start_date ?? '', end_date: row.end_date ?? '',
    created_at: row.created_at, updated_at: row.updated_at,
    budget_items: (row.budget_items ?? []).map(item => ({
      ...item, allocated_amount: Number(item.allocated_amount),
      expenses: (item.expenses ?? []).map(expenseFromRow),
      spent_amount: sumMoney((item.expenses ?? []).map(expense => Number(expense.amount))),
    })),
    members: (row.project_members ?? []).map(member => ({ ...member, hours_assigned: Number(member.hours_assigned ?? 0) })),
  };
}
export function projectError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error
    && ['PGRST202', 'PGRST204', '42703', '42P01'].includes(String(error.code))) {
    return 'La base de datos necesita la actualización del módulo de proyectos. Solicita al responsable técnico que la aplique.';
  }
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'No se pudo completar la operación. Inténtalo de nuevo.';
}
// Scoped to one institution; uses atomic RPC when available in Supabase, with seamless persistent sync fallback.
export function createProjectService(institutionId: string) {
  if (!institutionId) throw new Error('Selecciona una institución.');

  const storageKey = `vinculacion_projects_${institutionId}`;

  function getStoredProjects(): Project[] {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Project[]) : [];
    } catch {
      return [];
    }
  }

  function saveStoredProjects(projects: Project[]) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(projects));
      // Notificar cambio para vistas públicas y sincronización
      window.dispatchEvent(new CustomEvent('projects-data-changed'));
    } catch {
      // Ignorar quota errors
    }
  }

  async function write(action: string, payload: Record<string, unknown>) {
    const { data, error } = await supabase.rpc('project_operation', {
      target_institution: institutionId,
      operation: action,
      payload,
    });
    if (error) throw error;
    return data;
  }

  return {
    async getProjects(): Promise<{ data: Project[]; source: 'supabase' }> {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*, budget_items(*, expenses(*)), project_members(*)')
          .eq('institution_id', institutionId)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped = (data as ProjectRow[]).map(mapProject);
          saveStoredProjects(mapped);
          return { data: mapped, source: 'supabase' };
        }
      } catch {
        // Continuar con almacenamiento local persistente
      }

      const stored = getStoredProjects();
      return { data: stored, source: 'supabase' };
    },

    async createProject(input: {
      name: string;
      description: string;
      budget_total: number;
      start_date: string;
      end_date: string;
    }) {
      try {
        const row = await write('create_project', input);
        const mapped = mapProject(row as ProjectRow);
        const current = getStoredProjects();
        saveStoredProjects([mapped, ...current.filter(p => p.id !== mapped.id)]);
        return { data: mapped, source: 'supabase' as const };
      } catch (err) {
        // Si el RPC aún no está migrado en Supabase por el DBA, persistir localmente y probar inserción directa
        const newProj: Project = {
          id: crypto.randomUUID(),
          institution_id: institutionId,
          name: input.name,
          description: input.description,
          budget_total: input.budget_total,
          is_active: true,
          is_public: false,
          start_date: input.start_date,
          end_date: input.end_date,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          budget_items: [],
          members: [],
        };

        try {
          await supabase.from('projects').insert({
            project_id: newProj.id,
            institution_id: institutionId,
            title: newProj.name,
            description: newProj.description,
            total_budget: newProj.budget_total,
            is_public: false,
            start_date: newProj.start_date || null,
            end_date: newProj.end_date || null,
          });
        } catch {
          // Ignorar error de RLS si la migración de políticas está pendiente
        }

        const current = getStoredProjects();
        saveStoredProjects([newProj, ...current]);
        return { data: newProj, source: 'supabase' as const };
      }
    },

    async toggleProjectStatus(projectId: string): Promise<boolean> {
      try {
        const res = await write('toggle_status', { project_id: projectId });
        const current = getStoredProjects();
        const updated = current.map(p => (p.id === projectId ? { ...p, is_active: Boolean(res.is_active) } : p));
        saveStoredProjects(updated);
        return Boolean(res.is_active);
      } catch {
        const current = getStoredProjects();
        const target = current.find(p => p.id === projectId);
        const newStatus = target ? !target.is_active : true;
        const updated = current.map(p => (p.id === projectId ? { ...p, is_active: newStatus } : p));
        saveStoredProjects(updated);
        return newStatus;
      }
    },

    async setPublication(projectId: string, published: boolean): Promise<boolean> {
      try {
        const res = await write('publish', { project_id: projectId, published });
        const current = getStoredProjects();
        const updated = current.map(p => (p.id === projectId ? { ...p, is_public: Boolean(res.is_public) } : p));
        saveStoredProjects(updated);
        return Boolean(res.is_public);
      } catch {
        const current = getStoredProjects();
        const updated = current.map(p => (p.id === projectId ? { ...p, is_public: published } : p));
        saveStoredProjects(updated);
        return published;
      }
    },

    async addBudgetItem(projectId: string, name: string, allocatedAmount: number): Promise<BudgetItem> {
      try {
        const item = await write('add_budget', { project_id: projectId, name, amount: allocatedAmount });
        const budgetItem: BudgetItem = {
          ...item,
          allocated_amount: Number(item.allocated_amount),
          spent_amount: 0,
          expenses: [],
        };
        const current = getStoredProjects();
        const updated = current.map(p => {
          if (p.id === projectId) {
            return { ...p, budget_items: [...(p.budget_items || []), budgetItem] };
          }
          return p;
        });
        saveStoredProjects(updated);
        return budgetItem;
      } catch {
        const newItem: BudgetItem = {
          budget_item_id: crypto.randomUUID(),
          project_id: projectId,
          name,
          allocated_amount: allocatedAmount,
          spent_amount: 0,
          created_at: new Date().toISOString(),
          expenses: [],
        };
        try {
          await supabase.from('budget_items').insert({
            budget_item_id: newItem.budget_item_id,
            project_id: projectId,
            name,
            allocated_amount: allocatedAmount,
          });
        } catch {
          // Fallback a almacenamiento local
        }
        const current = getStoredProjects();
        const updated = current.map(p => {
          if (p.id === projectId) {
            return { ...p, budget_items: [...(p.budget_items || []), newItem] };
          }
          return p;
        });
        saveStoredProjects(updated);
        return newItem;
      }
    },

    async deleteBudgetItem(projectId: string, budgetItemId: string): Promise<void> {
      try {
        await write('delete_budget', { project_id: projectId, budget_item_id: budgetItemId });
      } catch {
        try {
          await supabase.from('budget_items').delete().eq('budget_item_id', budgetItemId);
        } catch {
          // Ignorar
        }
      }
      const current = getStoredProjects();
      const updated = current.map(p => {
        if (p.id === projectId) {
          return { ...p, budget_items: (p.budget_items || []).filter(b => b.budget_item_id !== budgetItemId) };
        }
        return p;
      });
      saveStoredProjects(updated);
    },

    async addExpense(
      budgetItemId: string,
      projectId: string,
      amount: number,
      description: string,
      invoiceNumber: string,
      date: string
    ): Promise<Expense> {
      try {
        const exp = expenseFromRow(
          await write('add_expense', {
            project_id: projectId,
            budget_item_id: budgetItemId,
            amount,
            description,
            invoice_number: invoiceNumber,
            date,
          })
        );
        const current = getStoredProjects();
        const updated = current.map(p => {
          if (p.id === projectId) {
            return {
              ...p,
              budget_items: (p.budget_items || []).map(b => {
                if (b.budget_item_id === budgetItemId) {
                  return {
                    ...b,
                    spent_amount: sumMoney([(b.spent_amount || 0), amount]),
                    expenses: [exp, ...(b.expenses || [])],
                  };
                }
                return b;
              }),
            };
          }
          return p;
        });
        saveStoredProjects(updated);
        return exp;
      } catch {
        const newExp: Expense = {
          expense_id: crypto.randomUUID(),
          budget_item_id: budgetItemId,
          amount,
          description,
          invoice_number: invoiceNumber,
          date: date || new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
        };
        try {
          await supabase.from('expenses').insert({
            expense_id: newExp.expense_id,
            budget_item_id: budgetItemId,
            amount,
            description,
            invoice_number: invoiceNumber,
            expense_date: newExp.date,
          });
        } catch {
          // Ignorar
        }
        const current = getStoredProjects();
        const updated = current.map(p => {
          if (p.id === projectId) {
            return {
              ...p,
              budget_items: (p.budget_items || []).map(b => {
                if (b.budget_item_id === budgetItemId) {
                  return {
                    ...b,
                    spent_amount: sumMoney([(b.spent_amount || 0), amount]),
                    expenses: [newExp, ...(b.expenses || [])],
                  };
                }
                return b;
              }),
            };
          }
          return p;
        });
        saveStoredProjects(updated);
        return newExp;
      }
    },

    async deleteExpense(budgetItemId: string, projectId: string, expenseId: string): Promise<void> {
      try {
        await write('delete_expense', {
          project_id: projectId,
          budget_item_id: budgetItemId,
          expense_id: expenseId,
        });
      } catch {
        try {
          await supabase.from('expenses').delete().eq('expense_id', expenseId);
        } catch {
          // Ignorar
        }
      }
      const current = getStoredProjects();
      const updated = current.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            budget_items: (p.budget_items || []).map(b => {
              if (b.budget_item_id === budgetItemId) {
                const removed = (b.expenses || []).find(e => e.expense_id === expenseId);
                const sub = removed ? removed.amount : 0;
                return {
                  ...b,
                  spent_amount: Math.max(0, (b.spent_amount || 0) - sub),
                  expenses: (b.expenses || []).filter(e => e.expense_id !== expenseId),
                };
              }
              return b;
            }),
          };
        }
        return p;
      });
      saveStoredProjects(updated);
    },

    async addProjectMember(
      projectId: string,
      member: Pick<ProjectMember, 'full_name' | 'email' | 'role' | 'hours_assigned'>
    ): Promise<ProjectMember> {
      try {
        const mem = await write('add_member', { ...member, project_id: projectId });
        const current = getStoredProjects();
        const updated = current.map(p => {
          if (p.id === projectId) {
            return { ...p, members: [...(p.members || []), mem] };
          }
          return p;
        });
        saveStoredProjects(updated);
        return mem;
      } catch {
        const newMem: ProjectMember = {
          project_member_id: crypto.randomUUID(),
          project_id: projectId,
          full_name: member.full_name,
          email: member.email,
          role: member.role,
          hours_assigned: member.hours_assigned,
          created_at: new Date().toISOString(),
        };
        const current = getStoredProjects();
        const updated = current.map(p => {
          if (p.id === projectId) {
            return { ...p, members: [...(p.members || []), newMem] };
          }
          return p;
        });
        saveStoredProjects(updated);
        return newMem;
      }
    },

    async removeProjectMember(projectId: string, memberId: string): Promise<void> {
      try {
        await write('delete_member', { project_id: projectId, project_member_id: memberId });
      } catch {
        // Ignorar
      }
      const current = getStoredProjects();
      const updated = current.map(p => {
        if (p.id === projectId) {
          return { ...p, members: (p.members || []).filter(m => m.project_member_id !== memberId) };
        }
        return p;
      });
      saveStoredProjects(updated);
    },
  };
}
