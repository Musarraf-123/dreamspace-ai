import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

const root = createRoot(document.getElementById('root'));
if (window.location.pathname === '/delete-account') {
  import('./DeleteAccountRequest.jsx').then(({ default: DeleteAccountRequest }) => {
    root.render(<React.StrictMode><DeleteAccountRequest /></React.StrictMode>);
  });
} else {
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
