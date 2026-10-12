import React, { useState, useMemo, useRef } from 'react';
import { createProjectService, projectError } from './projectService';
import { isMoney, sumMoney, remainingMoney, toCents } from './projectValidation';
import type { Project, BudgetItem, ProjectMember } from './types';

interface ProjectDetailsProps {
  project: Project;
  institutionName: string;
  canPublish: boolean;
  onBack: () => void;
  onProjectUpdate?: (project: Project) => void;
}

type DetailTab = 'rubros' | 'equipo' | 'resumen';

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ project, institutionName, canPublish, onBack, onProjectUpdate }) => {
  const projectService = useMemo(() => createProjectService(project.institution_id), [project.institution_id]);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  function withOperation<A extends unknown[]>(action: (...args: A) => Promise<void>) {
    return async (...args: A) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setErrorMsg('');
      try { await action(...args); } catch (cause) { setErrorMsg(projectError(cause)); }
      finally { inFlight.current = false; setBusy(false); }
    };
  }
  const [currentProject, setCurrentProject] = useState<Project>(project);
  const [activeTab, setActiveTab] = useState<DetailTab>('rubros');

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedItemForExpense, setSelectedItemForExpense] = useState<BudgetItem | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Forms state
  const [newItem, setNewItem] = useState({ name: '', allocated_amount: '' });
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', invoice_number: '', date: '' });
  const [newMember, setNewMember] = useState<{
    full_name: string;
    email: string;
    role: ProjectMember['role'];
    hours_assigned: string;
  }>({
    full_name: '',
    email: '',
    role: 'Estudiante Participante',
    hours_assigned: '96',
  });

  const [errorMsg, setErrorMsg] = useState('');

  const items = currentProject.budget_items || [];
  const members = currentProject.members || [];

  const totalAllocated = sumMoney(items.map(item => item.allocated_amount));
  const totalSpent = sumMoney(items.map(item => item.spent_amount));
  const availableBalance = remainingMoney(currentProject.budget_total, totalSpent);
  const unallocatedBudget = remainingMoney(currentProject.budget_total, totalAllocated);
  const executionPercent = currentProject.budget_total > 0
    ? Math.round((totalSpent / currentProject.budget_total) * 100)
    : 0;

  const updateParentState = (updated: Project) => {
    setCurrentProject(updated);
    if (onProjectUpdate) onProjectUpdate(updated);
  };

  const handleToggleStatus = withOperation(async () => {
    const newStatus = await projectService.toggleProjectStatus(currentProject.id);
    const updated = { ...currentProject, is_active: newStatus };
    updateParentState(updated);
  });

  const handleAddBudgetItem = withOperation(async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const amount = parseFloat(newItem.allocated_amount);
    if (!isMoney(amount) || amount <= 0) {
      setErrorMsg('El monto asignado debe ser mayor a 0.');
      return;
    }

    if (toCents(totalAllocated) + toCents(amount) > toCents(currentProject.budget_total)) {
      setErrorMsg(
        `La suma de rubros ($${(totalAllocated + amount).toFixed(2)}) supera el presupuesto total del proyecto ($${currentProject.budget_total.toFixed(2)}). Disponible por asignar: $${unallocatedBudget.toFixed(2)}.`
      );
      return;
    }

    try {
      const added = await projectService.addBudgetItem(currentProject.id, newItem.name.trim(), amount);
      const updatedItems = [...items, added];
      const updated = { ...currentProject, budget_items: updatedItems };
      updateParentState(updated);
      setIsItemModalOpen(false);
      setNewItem({ name: '', allocated_amount: '' });
    } catch (cause) {
      setErrorMsg(projectError(cause));
    }
  });

  const handleDeleteBudgetItem = withOperation(async (budgetItemId: string) => {
    if (!window.confirm('¿Eliminar este rubro? Solo se permite si no tiene gastos registrados.')) {
      return;
    }
    await projectService.deleteBudgetItem(currentProject.id, budgetItemId);
    const updatedItems = items.filter(it => it.budget_item_id !== budgetItemId);
    const updated = { ...currentProject, budget_items: updatedItems };
    updateParentState(updated);
  });

  const handleAddExpense = withOperation(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForExpense) return;
    setErrorMsg('');

    const expAmount = parseFloat(newExpense.amount);
    if (!isMoney(expAmount) || expAmount <= 0) {
      setErrorMsg('El monto del comprobante debe ser mayor a 0.');
      return;
    }

    const currentItemSpent = selectedItemForExpense.spent_amount || 0;
    if (toCents(currentItemSpent) + toCents(expAmount) > toCents(selectedItemForExpense.allocated_amount)) {
      setErrorMsg(
        `El gasto ($${expAmount.toFixed(2)}) supera el saldo disponible para este rubro ($${(selectedItemForExpense.allocated_amount - currentItemSpent).toFixed(2)}).`
      );
      return;
    }

    try {
      const addedExp = await projectService.addExpense(
        selectedItemForExpense.budget_item_id,
        currentProject.id,
        expAmount,
        newExpense.description.trim(),
        newExpense.invoice_number.trim(),
        newExpense.date
      );

      const updatedItems = items.map(it => {
        if (it.budget_item_id === selectedItemForExpense.budget_item_id) {
          const prevExpenses = it.expenses || [];
          return {
            ...it,
            spent_amount: sumMoney([it.spent_amount || 0, expAmount]),
            expenses: [addedExp, ...prevExpenses],
          };
        }
        return it;
      });

      const updated = { ...currentProject, budget_items: updatedItems };
      updateParentState(updated);
      setIsExpenseModalOpen(false);
      setSelectedItemForExpense(null);
      setNewExpense({ description: '', amount: '', invoice_number: '', date: '' });
    } catch (cause) {
      setErrorMsg(projectError(cause));
    }
  });

  const handleDeleteExpense = withOperation(async (budgetItemId: string, expenseId: string) => {
    if (!window.confirm('¿Deseas anular este comprobante de gasto?')) return;
    await projectService.deleteExpense(budgetItemId, currentProject.id, expenseId);

    const updatedItems = items.map(it => {
      if (it.budget_item_id === budgetItemId && it.expenses) {
        const removed = it.expenses.find(e => e.expense_id === expenseId);
        const subAmount = removed ? removed.amount : 0;
        return {
          ...it,
          spent_amount: remainingMoney(it.spent_amount || 0, subAmount),
          expenses: it.expenses.filter(e => e.expense_id !== expenseId),
        };
      }
      return it;
    });

    const updated = { ...currentProject, budget_items: updatedItems };
    updateParentState(updated);
  });

  const handleAddMember = withOperation(async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const hours = Number(newMember.hours_assigned);
    if (!Number.isInteger(hours) || hours <= 0 || hours > 10000) {
      setErrorMsg('Ingresa un numero de horas valido.');
      return;
    }

    try {
      const added = await projectService.addProjectMember(currentProject.id, {
        full_name: newMember.full_name.trim(),
        email: newMember.email.trim(),
        role: newMember.role,
        hours_assigned: hours,
      });

      const updatedMembers = [...members, added];
      const updated = { ...currentProject, members: updatedMembers };
      updateParentState(updated);
      setIsMemberModalOpen(false);
      setNewMember({ full_name: '', email: '', role: 'Estudiante Participante', hours_assigned: '96' });
    } catch (cause) {
      setErrorMsg(projectError(cause));
    }
  });

  const handleRemoveMember = withOperation(async (memberId: string) => {
    if (!window.confirm('¿Confirmas que deseas remover este participante del proyecto?')) return;
    await projectService.removeProjectMember(currentProject.id, memberId);
    const updatedMembers = members.filter(m => m.project_member_id !== memberId);
    const updated = { ...currentProject, members: updatedMembers };
    updateParentState(updated);
  });

  const handlePublication = withOperation(async () => {
    const nextPublished = !currentProject.is_public;
    const published = await projectService.setPublication(currentProject.id, nextPublished);
    updateParentState({ ...currentProject, is_public: published });
  });

  return (
    <fieldset disabled={busy} className="min-h-screen p-6 md:p-10 bg-gray-50 text-gray-800">
      {errorMsg && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-800">{errorMsg}</p>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs text-sm">
        <div className="flex items-center gap-3">
          <strong className="text-gray-900">{institutionName}</strong>
          <span className="text-gray-300">|</span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            currentProject.is_public ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            <span className={`size-1.5 rounded-full ${currentProject.is_public ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {currentProject.is_public ? 'Resumen público aprobado' : 'Proyecto privado'}
          </span>
        </div>
        {canPublish && (
          <button
            type="button"
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              currentProject.is_public
                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
            }`}
            onClick={handlePublication}
          >
            {currentProject.is_public ? 'Retirar de transparencia' : 'Aprobar resumen público'}
          </button>
        )}
      </div>
      {/* Boton volver */}
      <button
        onClick={onBack}
        className="mb-6 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1.5 transition-colors"
      >
        <span>&larr;</span> Volver al listado de proyectos
      </button>

      {/* Encabezado del proyecto */}
      <header className="bg-white p-6 rounded-md border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{currentProject.name}</h1>
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-medium border ${
                currentProject.is_active
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              {currentProject.is_active ? 'Proyecto Activo' : 'Proyecto Inactivo'}
            </span>
          </div>
          {currentProject.description && (
            <p className="text-gray-600 text-sm max-w-3xl leading-relaxed">{currentProject.description}</p>
          )}
          <div className="flex flex-wrap gap-5 mt-3 text-xs text-gray-500">
            <span>Fecha de inicio: <strong className="text-gray-700">{currentProject.start_date || 'No definida'}</strong></span>
            <span>Fecha de finalizacion: <strong className="text-gray-700">{currentProject.end_date || 'No definida'}</strong></span>
            <span>Participantes vinculados: <strong className="text-gray-700">{members.length}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleStatus}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700 transition-colors"
          >
            {currentProject.is_active ? 'Pausar Proyecto' : 'Activar Proyecto'}
          </button>
        </div>
      </header>

      {/* Tarjetas KPI de presupuesto */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider block">Presupuesto Asignado</span>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ${currentProject.budget_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-xs text-gray-400 mt-1 block">Monto total autorizado</span>
        </div>

        <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider block">Gastos Ejecutados</span>
          <p className="text-2xl font-bold text-red-600 mt-2">
            ${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-xs text-gray-400 mt-1 block">{executionPercent}% ejecutado</span>
        </div>

        <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider block">Saldo Disponible</span>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-xs text-gray-400 mt-1 block">Fondos por liquidar</span>
        </div>

        <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider block">Por Asignar en Rubros</span>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            ${unallocatedBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-xs text-gray-400 mt-1 block">Presupuesto sin rubro</span>
        </div>
      </div>

      {/* Navegacion interna por pestanas */}
      <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="flex border-b border-gray-200 px-6 pt-3 gap-6 bg-gray-50/50">
          <button
            onClick={() => setActiveTab('rubros')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'rubros'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Rubros Presupuestarios y Gastos ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('equipo')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'equipo'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Equipo y Participantes ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('resumen')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'resumen'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Resumen Financiero
          </button>
        </div>

        {/* Pestana 1: Rubros Presupuestarios */}
        {activeTab === 'rubros' && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Partidas de Gasto Autorizadas</h2>
                <p className="text-xs text-gray-500">Distribucion por concepto para compras, contratos y logistica institucional.</p>
              </div>
              <button
                onClick={() => {
                  setErrorMsg('');
                  setIsItemModalOpen(true);
                }}
                className="bg-blue-600 text-white py-1.5 px-4 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + Anadir Rubro
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-300 rounded-md">
                <p className="text-gray-600 font-medium text-sm">No hay rubros configurados para este proyecto.</p>
                <p className="text-gray-400 text-xs mt-1">Haz clic en "+ Anadir Rubro" para definir las partidas presupuestarias.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-xs uppercase border-b border-gray-200">
                      <th className="px-4 py-3">Concepto del Rubro</th>
                      <th className="px-4 py-3">Monto Asignado</th>
                      <th className="px-4 py-3">Ejecutado</th>
                      <th className="px-4 py-3">Saldo Rubro</th>
                      <th className="px-4 py-3">Consumo</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => {
                      const itemSpent = item.spent_amount || 0;
                      const itemBalance = remainingMoney(item.allocated_amount, itemSpent);
                      const percent = item.allocated_amount > 0 ? Math.min(100, Math.round((itemSpent / item.allocated_amount) * 100)) : 0;
                      const isExpanded = expandedItemId === item.budget_item_id;
                      const expenseList = item.expenses || [];

                      return (
                        <React.Fragment key={item.budget_item_id}>
                          <tr className="hover:bg-gray-50/70">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              <div>{item.name}</div>
                              {expenseList.length > 0 && (
                                <button
                                  onClick={() => setExpandedItemId(isExpanded ? null : item.budget_item_id)}
                                  className="text-xs text-blue-600 hover:underline mt-0.5"
                                >
                                  {isExpanded ? 'Ocultar comprobantes' : `Ver ${expenseList.length} comprobante(s)`}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-800">
                              ${item.allocated_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-red-600 font-semibold">
                              ${itemSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-emerald-700 font-medium">
                              ${itemBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-gray-200 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-2 rounded-full ${
                                      percent > 90 ? 'bg-red-500' : percent > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 font-medium">{percent}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setErrorMsg('');
                                    setSelectedItemForExpense(item);
                                    setIsExpenseModalOpen(true);
                                  }}
                                  className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 py-1 px-2.5 rounded border border-blue-200 transition-colors font-medium"
                                >
                                  + Gasto
                                </button>
                                <button
                                  onClick={() => handleDeleteBudgetItem(item.budget_item_id)}
                                  className="text-xs text-gray-400 hover:text-red-600 p-1"
                                  title="Eliminar rubro"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Sub-tabla desplegable de comprobantes/gastos */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="bg-gray-50 p-4 border-b border-gray-200">
                                <div className="bg-white rounded border border-gray-200 p-4">
                                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                                    Comprobantes registrados en: {item.name}
                                  </h3>
                                  {expenseList.length === 0 ? (
                                    <p className="text-xs text-gray-500">No hay comprobantes individuales registrados.</p>
                                  ) : (
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-gray-100 text-gray-500 text-left">
                                          <th className="pb-2">Fecha</th>
                                          <th className="pb-2">Nro. Comprobante</th>
                                          <th className="pb-2">Descripcion del gasto</th>
                                          <th className="pb-2 text-right">Monto</th>
                                          <th className="pb-2 text-right">Accion</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-50">
                                        {expenseList.map(exp => (
                                          <tr key={exp.expense_id} className="hover:bg-gray-50">
                                            <td className="py-2 text-gray-600">{exp.date}</td>
                                            <td className="py-2 font-mono text-gray-800">{exp.invoice_number || 'S/N'}</td>
                                            <td className="py-2 text-gray-700">{exp.description}</td>
                                            <td className="py-2 text-right font-semibold text-red-600">
                                              ${exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-2 text-right">
                                              <button
                                                onClick={() => handleDeleteExpense(item.budget_item_id, exp.expense_id)}
                                                className="text-red-500 hover:text-red-700"
                                              >
                                                Anular
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pestana 2: Equipo y Participantes */}
        {activeTab === 'equipo' && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Equipo de Vinculacion con la Sociedad</h2>
                <p className="text-xs text-gray-500">Docentes tutores, estudiantes y coordinadores asignados al proyecto.</p>
              </div>
              <button
                onClick={() => {
                  setErrorMsg('');
                  setIsMemberModalOpen(true);
                }}
                className="bg-blue-600 text-white py-1.5 px-4 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + Anadir Participante
              </button>
            </div>

            {members.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-300 rounded-md">
                <p className="text-gray-600 font-medium text-sm">No se han registrado participantes para este proyecto.</p>
                <p className="text-gray-400 text-xs mt-1">Haz clic en "+ Anadir Participante" para asignar docentes y estudiantes.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-xs uppercase border-b border-gray-200">
                      <th className="px-4 py-3">Nombre Completo</th>
                      <th className="px-4 py-3">Correo Institucional</th>
                      <th className="px-4 py-3">Rol en el Proyecto</th>
                      <th className="px-4 py-3">Horas Asignadas</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {members.map(member => (
                      <tr key={member.project_member_id} className="hover:bg-gray-50/70">
                        <td className="px-4 py-3 font-medium text-gray-900">{member.full_name}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{member.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              member.role === 'Coordinador'
                                ? 'bg-purple-100 text-purple-800'
                                : member.role === 'Docente Tutor'
                                ? 'bg-blue-100 text-blue-800'
                                : member.role === 'Estudiante Lider'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {member.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{member.hours_assigned} hrs</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemoveMember(member.project_member_id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pestana 3: Resumen Financiero */}
        {activeTab === 'resumen' && (
          <div className="project-report p-6">
            <p className="mb-3 font-semibold">{institutionName} · {currentProject.name}</p>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Informe de Ejecucion Financiera</h2>
            <p className="text-xs text-gray-500 mb-6">Estado global del presupuesto institucional y balance de liquidacion.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-5 rounded-md border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Balance General</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between pb-2 border-b border-gray-200">
                    <dt className="text-gray-600">Presupuesto Aprobado:</dt>
                    <dd className="font-semibold text-gray-900">${currentProject.budget_total.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-gray-200">
                    <dt className="text-gray-600">Total Rubros Asignados:</dt>
                    <dd className="font-semibold text-blue-600">${totalAllocated.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-gray-200">
                    <dt className="text-gray-600">Gastos Totales Ejecutados:</dt>
                    <dd className="font-semibold text-red-600">${totalSpent.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between pt-1">
                    <dt className="text-gray-900 font-bold">Saldo Disponible Real:</dt>
                    <dd className="font-bold text-emerald-600 text-base">${availableBalance.toFixed(2)}</dd>
                  </div>
                </dl>
              </div>

              <div className="bg-gray-50 p-5 rounded-md border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Indicadores de Gestion</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Porcentaje de Ejecucion Presupuestaria</span>
                      <span className="font-bold">{executionPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${executionPercent}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Presupuesto Distribuido en Partidas</span>
                      <span className="font-bold">
                        {currentProject.budget_total > 0 ? Math.round((totalAllocated / currentProject.budget_total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-purple-600 h-3 rounded-full"
                        style={{ width: `${currentProject.budget_total > 0 ? (totalAllocated / currentProject.budget_total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => window.print()}
                      className="w-full bg-white border border-gray-300 py-2 rounded text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Imprimir Informe / Guardar en PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Anadir Rubro */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-md p-6 max-w-md w-full shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">Anadir Partida de Presupuesto</h2>
              <button onClick={() => setIsItemModalOpen(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            {errorMsg && <p className="mb-3 text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">{errorMsg}</p>}
            <form onSubmit={handleAddBudgetItem} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Concepto o Nombre del Rubro</label>
                <input
                  type="text" required
                  placeholder="Ej. Equipos de computo para laboratorio"
                  value={newItem.name}
                  onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-medium text-gray-700">Monto Asignado ($)</label>
                  <span className="text-[11px] text-gray-500">Disponible: ${unallocatedBudget.toFixed(2)}</span>
                </div>
                <input
                  type="number" step="0.01" min="0.01" max={unallocatedBudget} required
                  placeholder="0.00"
                  value={newItem.allocated_amount}
                  onChange={e => setNewItem({ ...newItem, allocated_amount: e.target.value })}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsItemModalOpen(false)} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Cancelar</button>
                <button type="submit" className="px-4 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700">Guardar Rubro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Gasto */}
      {isExpenseModalOpen && selectedItemForExpense && (
        <div className="fixed inset-0 bg-gray-900/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-md p-6 max-w-md w-full shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Registrar Comprobante de Gasto</h2>
                <p className="text-xs text-gray-500">Rubro: {selectedItemForExpense.name}</p>
              </div>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            {errorMsg && <p className="mb-3 text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">{errorMsg}</p>}
            <form onSubmit={handleAddExpense} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripcion del Comprobante</label>
                <input
                  type="text" required
                  placeholder="Ej. Factura adquisicion cables de red"
                  value={newExpense.description}
                  onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Monto ($)</label>
                  <input
                    type="number" step="0.01" min="0.01" required
                    value={newExpense.amount}
                    onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nro. de Factura</label>
                  <input
                    type="text"
                    placeholder="FAC-00123"
                    value={newExpense.invoice_number}
                    onChange={e => setNewExpense({ ...newExpense, invoice_number: e.target.value })}
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de Emision</label>
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Cancelar</button>
                <button type="submit" className="px-4 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700">Guardar Gasto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Anadir Participante */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-md p-6 max-w-md w-full shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">Anadir Participante de Vinculacion</h2>
              <button onClick={() => setIsMemberModalOpen(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            {errorMsg && <p className="mb-3 text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">{errorMsg}</p>}
            <form onSubmit={handleAddMember} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre Completo</label>
                <input
                  type="text" required
                  placeholder="Ej. Marlon Demera"
                  value={newMember.full_name}
                  onChange={e => setNewMember({ ...newMember, full_name: e.target.value })}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Correo Institucional</label>
                <input
                  type="email" required
                  placeholder="ejemplo@institucion.edu.ec"
                  value={newMember.email}
                  onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
                  <select
                    value={newMember.role}
                    onChange={e => setNewMember({ ...newMember, role: e.target.value as ProjectMember['role'] })}
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="Coordinador">Coordinador</option>
                    <option value="Docente Tutor">Docente Tutor</option>
                    <option value="Estudiante Lider">Estudiante Lider</option>
                    <option value="Estudiante Participante">Estudiante Participante</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Horas Asignadas</label>
                  <input
                    type="number" min="1" max="500" required
                    value={newMember.hours_assigned}
                    onChange={e => setNewMember({ ...newMember, hours_assigned: e.target.value })}
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsMemberModalOpen(false)} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Cancelar</button>
                <button type="submit" className="px-4 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700">Guardar Participante</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </fieldset>
  );
};
