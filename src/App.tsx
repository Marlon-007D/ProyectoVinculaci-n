import { BrowserRouter } from 'react-router-dom';
import { SiteApp } from './modules/site';

export default function App() {
  return (
    <BrowserRouter>
      <SiteApp />
    </BrowserRouter>
  );
}
