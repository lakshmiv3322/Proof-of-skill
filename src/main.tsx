import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Lock dark mode globally — ProofOfSkill is a dark-first instrument UI.
// Must run before React hydration to prevent light-mode flash.
document.documentElement.classList.add('dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
