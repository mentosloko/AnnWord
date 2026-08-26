import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './AppV2';
import ErrorBoundary from './components/ErrorBoundary';
import { PasswordResetOverlay } from './components/auth/PasswordResetOverlay';
import { MagicLinkOverlay } from './components/auth/MagicLinkOverlay';
import { ParentPinResetOverlay } from './components/auth/ParentPinResetOverlay';
import { getKnownClientPaths } from './services/clientRoute';
import { applyNotFoundMetadata } from './services/pageMetadata';
import './visualAssets.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const FrontendApiFallback: React.FC = () => (
  <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
    <section className="max-w-xl rounded-3xl bg-white p-8 shadow-sm">
      <div className="text-5xl" aria-hidden="true">🔒</div>
      <h1 className="mt-4 text-3xl font-black text-slate-900">API endpoint unavailable here</h1>
      <p className="mt-3 text-sm font-bold leading-relaxed text-slate-600">
        This is the AnnWord frontend bucket. API requests must go to the AnnWord backend API domain, not to the static frontend URL.
      </p>
    </section>
  </main>
);

const normalizePath = (value: string): string => value.replace(/\/+$/, '') || '/';
const knownPaths = new Set(getKnownClientPaths().map(normalizePath));
const isKnownClientPath = (pathname: string): boolean => knownPaths.has(normalizePath(pathname));

const NotFoundScreen: React.FC = () => {
  React.useEffect(() => { applyNotFoundMetadata(); }, []);
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 text-center">
      <section className="w-full max-w-xl rounded-[2rem] bg-white p-8 shadow-xl ring-1 ring-indigo-100 sm:p-10">
        <div className="text-6xl" aria-hidden="true">🧭</div>
        <p className="mt-5 text-sm font-black uppercase tracking-wider text-indigo-500">Ошибка 404</p>
        <h1 className="mt-2 text-3xl font-black text-indigo-950 sm:text-4xl">Такой страницы нет</h1>
        <p className="mt-3 text-base font-medium leading-relaxed text-slate-600">Ссылка могла устареть или в адресе есть опечатка. Вернитесь на главную AnnWord и продолжите оттуда.</p>
        <a href="/" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-indigo-600 px-6 py-3 font-black text-white shadow-lg transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200">На главную</a>
      </section>
    </main>
  );
};

const pathname = window.location.pathname;
const content = pathname.startsWith('/api/')
  ? <FrontendApiFallback />
  : isKnownClientPath(pathname)
    ? <><App /><PasswordResetOverlay /><MagicLinkOverlay /><ParentPinResetOverlay /></>
    : <NotFoundScreen />;

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>{content}</ErrorBoundary>
  </React.StrictMode>
);
