import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../core/AuthContext';
import { AcademicContentManager } from '../../academic-content/components/AcademicContentManager';
import { AdminCourseCategoriesPage } from './AdminCourseCategoriesPage';
import { AdminCoursesPage } from './AdminCoursesPage';

export function AcademicManagementRoutes() {
  const { pathname } = useLocation();
  const { user, role } = useAuth();

  if (!user) return <Navigate to="/panel/admin" replace />;
  if (role !== 'super_admin' && role !== 'institution_admin')
    return <main role="alert">Tu cuenta no tiene acceso a la administración académica.</main>;

  if (pathname === '/panel/cursos') return <Navigate to="/panel/cursos/categorias" replace />;
  if (pathname.startsWith('/panel/cursos/categorias/')) return <AdminCourseCategoriesPage />;
  if (pathname.startsWith('/panel/cursos/modulos/')) return <AdminCoursesPage />;
  if (pathname === '/panel/publicaciones') return <Navigate to="/panel/publicaciones/noticias" replace />;

  switch (pathname) {
    case '/panel/cursos/categorias':
      return <AdminCourseCategoriesPage />;
    case '/panel/cursos/modulos':
      return <AdminCoursesPage />;
    case '/panel/publicaciones/noticias':
      return <AcademicContentManager kind="news" title="Noticias" singular="Noticia" />;
    case '/panel/publicaciones/eventos':
      return <AcademicContentManager kind="event" title="Eventos" singular="Evento" />;
    case '/panel/publicaciones/cuadro-de-honor':
      return <AcademicContentManager kind="honor" title="Cuadro de honor" singular="Reconocimiento" />;
    default:
      return <Navigate to="/panel/cursos/categorias" replace />;
  }
}
