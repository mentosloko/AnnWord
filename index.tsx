import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const AUTH_RECOVERY_FLAG = 'annword_auth_recovery_attempted';

function AppWithAuthRecovery() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const hasAuthError = url.searchParams.has('auth_error') || url.searchParams.has('error') || url.hash.includes('error=');

    if (!hasAuthError) {
      window.sessionStorage.removeItem(AUTH_RECOVERY_FLAG);
      return;
    }

    const timeout = window.setTimeout(() => {
      const alreadyRecovered = window.sessionStorage.getItem(AUTH_RECOVERY_FLAG) === '1';
      const visibleText = document.body.innerText.toLowerCase();
      const looksStuckOnLoader =
        visibleText.includes('загруз') ||
        visibleText.includes('loading') ||
        visibleText.includes('подожд');

      if (alreadyRecovered || !looksStuckOnLoader) return;

      window.sessionStorage.setItem(AUTH_RECOVERY_FLAG, '1');

      Object.keys(window.localStorage)
        .filter(key => key.startsWith('sb-') && key.includes('auth-token'))
        .forEach(key => window.localStorage.removeItem(key));

      url.searchParams.delete('auth_error');
      url.searchParams.delete('error');
      url.searchParams.delete('error_code');
      url.searchParams.delete('error_description');
      url.hash = '';
      window.location.replace(url.toString());
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, []);

  return <App />;
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppWithAuthRecovery />
    </ErrorBoundary>
  </React.StrictMode>
);
