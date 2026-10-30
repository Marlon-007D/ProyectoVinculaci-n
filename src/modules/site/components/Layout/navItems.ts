import { ArrowLeftRight, Award, Building2, Calculator, CalendarDays, FileText, FolderKanban, HeartHandshake, Home, Inbox, Layers3, Newspaper, PanelTop, ReceiptText, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import type { InstitutionModuleName } from '../../../../core/TenantContext';
import { roleCanOpenModule } from '../../../admin/auth/roleModules.ts';

export type NavItem = { label: string; path: string; icon: LucideIcon; tone: string; description: string; module?: InstitutionModuleName };

// Every entry is a first-level pill of the same kind: no groups, no nested items.
const inicio: NavItem = { label: 'Inicio', path: '/panel', icon: Home, tone: 'home', description: 'Resumen del panel institucional' };
const proyectos: NavItem = { label: 'Proyectos', path: '/panel/proyectos', icon: FolderKanban, tone: 'projects', description: 'Gestiona proyectos de vinculación', module: 'projects' };
const deceItems: NavItem[] = [
  { label: 'Inicio DECE', path: '/panel/dece', icon: Home, tone: 'dece-home', description: 'Resumen del departamento DECE', module: 'dece' },
  { label: 'Estudiantes', path: '/panel/dece/estudiantes', icon: Users, tone: 'dece-students', description: 'Estudiantes y sus fichas', module: 'dece' },
  { label: 'Casos', path: '/panel/dece/casos', icon: HeartHandshake, tone: 'dece-cases', description: 'Casos de acompañamiento', module: 'dece' },
  { label: 'Plantillas de fichas', path: '/panel/dece/plantillas', icon: FileText, tone: 'dece-forms', description: 'Plantillas de las fichas', module: 'dece' },
  { label: 'Revisión de fichas', path: '/panel/dece/envios', icon: Inbox, tone: 'dece-reviews', description: 'Fichas enviadas por revisar', module: 'dece' },
];
const simuladores: NavItem[] = [
  { label: 'Facturación electrónica', path: '/panel/simuladores/facturacion', icon: ReceiptText, tone: 'invoice', description: 'Simulador de facturación', module: 'simuladores' },
  { label: 'Unidades y monedas', path: '/panel/simuladores/conversor', icon: ArrowLeftRight, tone: 'converter', description: 'Conversor de unidades y monedas', module: 'simuladores' },
  { label: 'Interés financiero', path: '/panel/simuladores/interes', icon: Calculator, tone: 'interest', description: 'Simulador de interés', module: 'simuladores' },
];
const portal: NavItem = { label: 'Portal Web', path: '/panel/portal', icon: PanelTop, tone: 'portal', description: 'Administra el contenido del sitio institucional', module: 'portal' };
const administracion: NavItem = { label: 'Administración', path: '/panel/admin', icon: ShieldCheck, tone: 'admin', description: 'Consulta cuentas, accesos y permisos' };
const academicItems: NavItem[] = [
  { label: 'Categorías', path: '/panel/cursos/categorias', icon: FolderKanban, tone: 'categories', description: 'Clasifica la oferta de cursos' },
  { label: 'Módulos', path: '/panel/cursos/modulos', icon: Layers3, tone: 'modules', description: 'Contenidos de los cursos' },
  { label: 'Noticias', path: '/panel/publicaciones/noticias', icon: Newspaper, tone: 'news', description: 'Novedades institucionales' },
  { label: 'Eventos', path: '/panel/publicaciones/eventos', icon: CalendarDays, tone: 'events', description: 'Actividades y fechas' },
  { label: 'Cuadro de honor', path: '/panel/publicaciones/cuadro-de-honor', icon: Award, tone: 'honor', description: 'Reconocimientos estudiantiles' },
];
const superAdminItems: NavItem[] = [
  { label: 'Instituciones educativas', path: '/panel/superadmin', icon: Building2, tone: 'institutions', description: 'Gestiona las instituciones del sistema' },
  { label: 'Seguridad y usuarios', path: '/panel/admin', icon: ShieldCheck, tone: 'admin', description: 'Administra cuentas y permisos' },
];

/** Items each role may see: module items need the module enabled and a role that can open it. */
export function visibleNavItems(role: string | null, hasModuleAccess: (module: InstitutionModuleName) => boolean): NavItem[] {
  const canManageAcademicContent = role === 'super_admin' || role === 'institution_admin';
  if (role === 'super_admin') return [...superAdminItems, ...academicItems];
  const open = (item: NavItem) => !item.module || (hasModuleAccess(item.module) && roleCanOpenModule(role, item.module));
  if (role === 'dece_staff') return [inicio, ...deceItems.filter(open)];
  return [inicio, proyectos, ...deceItems, ...simuladores, portal, administracion, ...(canManageAcademicContent ? academicItems : [])].filter(open);
}
