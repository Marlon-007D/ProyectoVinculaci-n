import {Navigate,Route,Routes,useLocation,useSearchParams} from 'react-router-dom';
import {ProjectsWorkspace} from '../ProjectsWorkspace';
import {PublicProjects} from '../PublicProjects';
import {InstitutionProvider,useInstitution} from '../../site/context/InstitutionContext';
import {SiteLayout} from '../../site/components/Layout/SiteLayout';

function InstitutionalTransparency(){
  const {institution}=useInstitution();
  return <PublicProjects key={institution!.slug} institutionSlug={institution!.slug} institutionName={institution!.name}/>;
}

export default function ModuleRoutes(){
  const {pathname}=useLocation();const [params]=useSearchParams();
  if(pathname==='/portal'||pathname.startsWith('/portal/')){
    const shared=new URLSearchParams(params);const page=shared.get('page');
    if(page){shared.set('slug',page);shared.delete('page');}
    return <Navigate to={'/?'+shared.toString()} replace/>;
  }
  if(pathname==='/panel/portal'||pathname.startsWith('/panel/portal/'))return <ProjectsWorkspace mode="portal"/>;
  if(params.has('transparency'))return <InstitutionProvider><Routes><Route element={<SiteLayout/>}><Route path="*" element={<InstitutionalTransparency/>}/></Route></Routes></InstitutionProvider>;
  return <ProjectsWorkspace/>;
}
