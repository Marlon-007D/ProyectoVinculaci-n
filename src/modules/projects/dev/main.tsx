import 'bootstrap/dist/css/bootstrap.min.css';
import {createRoot} from 'react-dom/client';
import '../../../index.css';
import {BrowserRouter} from 'react-router-dom';
import {InstitutionalWorkspace} from './InstitutionalWorkspace';
import {PublishedPortal} from '../../portal-editor/PublishedPortal';

createRoot(document.getElementById('root')!).render(<BrowserRouter>{location.pathname.startsWith('/portal')?<PublishedPortal/>:<InstitutionalWorkspace/>}</BrowserRouter>);
