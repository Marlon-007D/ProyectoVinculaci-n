import {useLocation,useSearchParams} from 'react-router-dom';
import {ProjectsWorkspace} from '../ProjectsWorkspace';
import {PublicProjects} from '../PublicProjects';
import {PublishedPortal} from '../../portal-editor/PublishedPortal';

export default function ModuleRoutes(){
  const {pathname}=useLocation();const [params]=useSearchParams();
  if(pathname==='/portal'||pathname.startsWith('/portal/'))return <PublishedPortal/>;
  if(pathname==='/panel/portal'||pathname.startsWith('/panel/portal/'))return <ProjectsWorkspace mode="portal"/>;
  if(params.has('transparency'))return <PublicProjects/>;
  return <ProjectsWorkspace/>;
}
