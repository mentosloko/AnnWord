import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './AppV2';
import ErrorBoundary from './components/ErrorBoundary';
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

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {window.location.pathname.startsWith('/api/') ? <FrontendApiFallback /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);
