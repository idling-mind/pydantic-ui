import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

// Get configuration from window if available (set by server)
declare global {
  interface Window {
    PYDANTIC_UI_CONFIG?: {
      apiBase?: string;
    };
  }
}

const config = window.PYDANTIC_UI_CONFIG || {};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App apiBase={config.apiBase} />
  </React.StrictMode>
);
