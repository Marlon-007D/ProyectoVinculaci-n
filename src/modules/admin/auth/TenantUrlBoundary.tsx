import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/AuthContext';
import { supabase } from '../../../core/supabaseClient';
import { canonicalTenantSearch, resolveTenantIdentity, type TenantIdentity } from './tenantUrl';
import { currentAdminScope } from './institutionNavigation';
import styles from './TenantUrlBoundary.module.css';

interface MembershipIdentity { institutions: (TenantIdentity & { is_active: boolean }) | null }
type Resolution = { key: string; status: 'ready'; tenant?: TenantIdentity } | { key: string; status: 'error' };

export function TenantUrlBoundary({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const key = `${user?.id ?? ''}:${location.search}`;
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function resolve() {
      try {
        const { data, error } = await supabase.from('memberships')
          .select('institutions(institution_id,slug,name,is_active)')
          .eq('profile_id', user!.id).eq('is_active', true)
          .overrideTypes<MembershipIdentity[], { merge: false }>();
        if (cancelled) return;
        if (error || !data) throw new Error('No se pudo verificar el plantel.');
        const scope = currentAdminScope(location.search);
        const search = new URLSearchParams(location.search);
        if (!search.has('institution') && !search.has('slug')) {
          if (scope.institution) search.set('institution', scope.institution);
          if (scope.slug) search.set('slug', scope.slug);
        }
        const tenant = resolveTenantIdentity(data.flatMap(row => row.institutions?.is_active ? [row.institutions] : []), search.toString());
        if (tenant) {
          const normalized = canonicalTenantSearch(location.search, tenant);
          if (normalized !== location.search) {
            navigate({ pathname: location.pathname, search: normalized, hash: location.hash }, { replace: true });
            return;
          }
          currentAdminScope(normalized);
        }
        setResolution({ key, status: 'ready', tenant });
      } catch {
        if (!cancelled) setResolution({ key, status: 'error' });
      }
    }
    void resolve();
    return () => { cancelled = true; };
  }, [user?.id, key, location.pathname, location.search, location.hash, navigate, revision]);
  const tenant = resolution?.key === key && resolution.status === 'ready' ? resolution.tenant : undefined;
  useEffect(() => {
    if (!tenant) return;
    const previous = document.title;
    document.title = `${tenant.name} | Administración`;
    return () => { document.title = previous; };
  }, [tenant]);
  if (!user) return children;
  if (resolution?.key !== key) return <p role="status">Verificando unidad educativa…</p>;
  if (resolution.status === 'error') return <section role="alert"><p>No se pudo verificar la unidad educativa.</p><button type="button" onClick={() => { setResolution(null); setRevision(value => value + 1); }}>Reintentar</button></section>;
  return <>{tenant && <header className={styles.identity}><h1>{tenant.name}</h1></header>}{children}{tenant && <footer className={styles.identity}>{tenant.name}</footer>}</>;
}
