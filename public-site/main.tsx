import { createRoot } from 'react-dom/client';
import Workbench from '../app/workbench';
import '../app/workbench.css';
import '../app/map.css';
createRoot(document.getElementById('root')!).render(<Workbench/>);
