// Standalone price-free route; never imported by the primary entry.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppPreferencesProvider } from '../../i18n/AppPreferences';
import { BrowserRouter } from 'react-router-dom';
// Match the original cascade: preferences/tactile, reset/fonts, brand, sales.
import '../../index.css';
import '../../brand/olb.css';
import PlumbingPitchPage from './PlumbingPitchPage';
import { startPlumbingDiagnostics } from './plumbingStartup';

startPlumbingDiagnostics();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppPreferencesProvider>
      <BrowserRouter>
        <PlumbingPitchPage />
      </BrowserRouter>
    </AppPreferencesProvider>
  </React.StrictMode>,
);
