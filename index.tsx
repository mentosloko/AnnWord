import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const AUTH_RECOVERY_FLAG = 'annword_auth_recovery_attempted';

const clearSupabaseAuthStorage = () => {
  Object.keys(window.localStorage)
    .filter(key => key.startsWith('sb-') && key.includes('auth-token'))
    .forEach(key => window.localStorage.removeItem(key));
};

const stripAuthErrorFromUrlBeforeReactMount = () => {
  const url = new URL(window.location.href);
  const hasAuthError =
    url.searchParams.has('auth_error') ||
    url.searchParams.has('error') ||
    url.searchParams.has('error_code') ||
    url.hash.includes('error=');

  if (!hasAuthError) return false;

  clearSupabaseAuthStorage();
  url.searchParams.delete('auth_error');
  url.searchParams.delete('error');
  url.searchParams.delete('error_code');
  url.searchParams.delete('error_description');
  url.hash = '';
  window.history.replaceState({}, document.title, url.toString());
  return true;
};

stripAuthErrorFromUrlBeforeReactMount();

function AppWithAuthRecovery() {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const alreadyRecovered = window.sessionStorage.getItem(AUTH_RECOVERY_FLAG) === '1';
      const visibleText = document.body.innerText.toLowerCase();
      const looksStuckOnLoader =
        visibleText.includes('загруз') ||
        visibleText.includes('loading') ||
        visibleText.includes('подожд');

      if (alreadyRecovered || !looksStuckOnLoader) return;

      window.sessionStorage.setItem(AUTH_RECOVERY_FLAG, '1');
      clearSupabaseAuthStorage();
      const url = new URL(window.location.href);
      url.searchParams.delete('auth_error');
      url.searchParams.delete('error');
      url.searchParams.delete('error_code');
      url.searchParams.delete('error_description');
      url.hash = '';
      window.location.replace(url.toString());
    }, 10000);

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
