import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initWebApi } from './api/webApi';
import './styles/theme.css';

// Inicializa API Web (fetch) se não estiver no Electron
initWebApi();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
