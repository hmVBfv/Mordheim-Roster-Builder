import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { startTrail } from './bugs/trail.ts';
import { applyTheme, watchSystemTheme } from './theme/theme.ts';
import './theme/base.css';

startTrail();
applyTheme();
watchSystemTheme();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
