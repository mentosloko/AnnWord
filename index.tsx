import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { supabase } from './supabase';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const AUTH_RECOVERY_FLAG = 'annword_auth_recovery_attempted';
const OAuthTransitionOverlay = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950 text-white">
    <div className="mx-4 max-w-sm rounded-3xl border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
      <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      <div className="text-xl font-black">Завершаем вход</div>
      <div className="mt-3 text-sm leading-relaxed text-white/75">
        Получаем сессию и загружаем профиль. Это может занять несколько секунд после возврата из Яндекса.
      </div>
    </div>
  </div>
);

const clearSupabaseAuthStorage = () => {
  Object.keys(window.localStorage)
    .filter(key => key.startsWith('sb-') && key.includes('auth-token'))
    .forEach(key => window.localStorage.removeItem(key));
};

const getInitialAuthReturnState = () => {
  const href = window.location.href;
  const url = new URL(href);
  const hash = url.hash || '';

  return {
    hasError:
      url.searchParams.has('auth_error') ||
      url.searchParams.has('error') ||
      url.searchParams.has('error_code') ||
      hash.includes('error='),
    hasOAuthSuccess:
      url.searchParams.has('code') ||
      url.searchParams.has('sb') ||
      hash.includes('access_token=') ||
      hash.includes('refresh_token=') ||
      hash.includes('provider_token=') ||
      hash.includes('type=recovery') ||
      hash.includes('type=magiclink')
  };
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

const initialAuthReturnState = getInitialAuthReturnState();
stripAuthErrorFromUrlBeforeReactMount();

function AppWithAuthRecovery() {
  const [isCompletingOAuth, setIsCompletingOAuth] = useState(initialAuthReturnState.hasOAuthSuccess && !initialAuthReturnState.hasError);

  useEffect(() => {
    if (!isCompletingOAuth) return;

    let cancelled = false;
    let minimumTimer: number | undefined;
    let maximumTimer: number | undefined;

    const finish = () => {
      if (cancelled) return;
      setIsCompletingOAuth(false);
    };

    minimumTimer = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) finish();
    }, 1800);

    maximumTimer = window.setTimeout(finish, 9000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        window.setTimeout(finish, 700);
      }
    });

    return () => {
      cancelled = true;
      if (minimumTimer) window.clearTimeout(minimumTimer);
      if (maximumTimer) window.clearTimeout(maximumTimer);
      subscription.unsubscribe();
    };
  }, [isCompletingOAuth]);

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

  return (
    <>
      <App />
      {isCompletingOAuth && <OAuthTransitionOverlay />}
    </>
  );
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppWithAuthRecovery />
    </ErrorBoundary>
  </React.StrictMode>
);
