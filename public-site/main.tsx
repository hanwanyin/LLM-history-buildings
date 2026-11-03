import { createRoot } from 'react-dom/client';
import '../app/workbench.css';
import '../app/map.css';
import Workbench from '../app/workbench';
createRoot(document.getElementById('root')!).render(<Workbench/>);
