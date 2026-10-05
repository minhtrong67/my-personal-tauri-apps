import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import 'material-symbols/rounded.css';
import './index.css';
import App from './App';
import { applyTheme } from './lib/theme';

applyTheme('#6750A4', 'system');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
