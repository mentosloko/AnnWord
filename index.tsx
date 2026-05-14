import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { supabase } from './supabase';
import { HOME_NAVIGATION_EVENT, HOME_NAVIGATION_FLAG } from './utils/navigationBridge';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const AuthTransitionOverlay = ({ title = 'Восстанавливаем вход' }: { title?: string }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950 text-white">
    <div className="mx-4 max-w-sm rounded-3xl border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
      <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      <div className="text-xl font-black">{title}</div>
      <div className="mt-3 text-sm leading-relaxed text-white/75">
        Получаем сессию и загружаем профиль. Это может занять несколько секунд.
      </div>
    </div>
  </div>
);

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

  url.searchParams.delete('auth_error');
  url.searchParams.delete('error');
  url.searchParams.delete('error_code');
  url.searchParams.delete('error_description');
  url.hash = '';
  window.history.replaceState({}, document.title, url.toString());
  return true;
};

const cleanNavigationUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('screen');
  url.searchParams.delete('t');
  window.history.replaceState({}, document.title, url.toString());
};

const initialAuthReturnState = getInitialAuthReturnState();
stripAuthErrorFromUrlBeforeReactMount();

function AppWithAuthRecovery() {
  const shouldStartHome = window.sessionStorage.getItem(HOME_NAVIGATION_FLAG) === '1';
  const [isCompletingOAuth, setIsCompletingOAuth] = useState(initialAuthReturnState.hasOAuthSuccess && !initialAuthReturnState.hasError);
  const [isHydratingPersistedSession, setIsHydratingPersistedSession] = useState(!shouldStartHome);
  const [appInstanceKey, setAppInstanceKey] = useState(() => {
    if (shouldStartHome) {
      window.sessionStorage.removeItem(HOME_NAVIGATION_FLAG);
      cleanNavigationUrl();
    }
    return shouldStartHome ? 1 : 0;
  });

  useEffect(() => {
    if (!isHydratingPersistedSession) return;

    let cancelled = false;
    let maxTimer: number | undefined;

    const finish = () => {
      if (cancelled) return;
      setIsHydratingPersistedSession(false);
    };

    const bootstrap = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          finish();
          return;
        }

        maxTimer = window.setTimeout(finish, 4500);
      } catch (_error) {
        finish();
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        finish();
        return;
      }
      window.setTimeout(finish, 900);
    });

    bootstrap();

    return () => {
      cancelled = true;
      if (maxTimer) window.clearTimeout(maxTimer);
      subscription.unsubscribe();
    };
  }, [isHydratingPersistedSession]);

  useEffect(() => {
    const handleNavigateHome = () => {
      window.sessionStorage.removeItem(HOME_NAVIGATION_FLAG);
      cleanNavigationUrl();
      setIsCompletingOAuth(false);
      setIsHydratingPersistedSession(false);
      setAppInstanceKey(prev => prev + 1);
    };

    window.addEventListener(HOME_NAVIGATION_EVENT, handleNavigateHome);
    return () => window.removeEventListener(HOME_NAVIGATION_EVENT, handleNavigateHome);
  }, []);

  useEffect(() => {
    if (!isCompletingOAuth) return;

    let cancelled = false;
    let maximumTimer: number | undefined;

    const finish = () => {
      if (cancelled) return;
      setIsCompletingOAuth(false);
    };

    maximumTimer = window.setTimeout(finish, 9000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        window.setTimeout(finish, 700);
      }
    });

    return () => {
      cancelled = true;
      if (maximumTimer) window.clearTimeout(maximumTimer);
      subscription.unsubscribe();
    };
  }, [isCompletingOAuth]);

  const showAuthOverlay = isCompletingOAuth || isHydratingPersistedSession;

  return (
    <>
      <App key={appInstanceKey} />
      {showAuthOverlay && (
        <AuthTransitionOverlay title={isCompletingOAuth ? 'Завершаем вход' : 'Восстанавливаем вход'} />
      )}
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
