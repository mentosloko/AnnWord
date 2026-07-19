import React from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary';
import './visualAssets.css';

const AppRuntime = React.lazy(() => import('./AppRuntime'));

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

const AppBootShell: React.FC = () => (
  <div className="flex min-h-screen flex-col bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-900" aria-busy="true" aria-label="AnnWord загружается">
    <header className="flex w-full items-center justify-between gap-2 border-b border-indigo-50 bg-white/85 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
      <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
        <img src="/assets/branding/annword-logo-mark.svg" alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11" draggable={false} />
        <span className="truncate text-lg font-black leading-none text-[#121821] sm:text-xl">AnnWord</span>
      </div>
      <span className="rounded-xl bg-indigo-100 px-4 py-2 text-sm font-black text-indigo-500">Войти</span>
    </header>

    <div className="flex-1">
      <main className="mx-auto min-h-[1270px] w-full max-w-7xl px-4 pb-20 pt-3 sm:min-h-[980px] sm:pt-5 lg:min-h-[850px]">
        <section className="overflow-hidden rounded-[1.75rem] border-2 border-indigo-50 bg-white shadow-sm sm:rounded-[2.25rem]">
          <div className="grid gap-5 p-4 sm:p-8 lg:grid-cols-[1fr_35rem] lg:items-center">
            <div className="py-1 sm:py-2">
              <div className="mb-3 inline-flex rounded-full bg-indigo-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500 sm:mb-4 sm:px-4 sm:py-2 sm:text-xs">AnnWord · игровые тренировки слов</div>
              <h1 className="max-w-3xl text-3xl font-black leading-[1.02] tracking-tight text-indigo-950 sm:text-6xl">Английские слова, которые остаются в памяти</h1>
              <p className="mt-3 max-w-2xl text-sm font-bold leading-relaxed text-slate-600 sm:mt-5 sm:text-lg">Короткие игры помогают вспомнить, собрать и узнать слово. Сложное автоматически возвращается в повторение.</p>
              <div className="mt-5 flex flex-col gap-2 sm:mt-7 sm:flex-row sm:gap-3">
                <span className="rounded-2xl bg-blue-600 px-6 py-3.5 text-center text-base font-black text-white shadow-lg sm:py-4">Выбрать формат и начать</span>
                <span className="rounded-2xl border-2 border-slate-100 bg-white px-6 py-3.5 text-center text-base font-black text-slate-600 sm:py-4">Войти</span>
              </div>
            </div>
            <div className="mx-auto hidden aspect-[4/3] w-full max-w-[36rem] rounded-[2.25rem] bg-gradient-to-br from-sky-100 via-white to-indigo-50 shadow-2xl shadow-indigo-900/10 md:block" />
          </div>
          <div className="border-y border-indigo-50 bg-gradient-to-b from-white to-indigo-50/60 px-4 py-4 sm:px-8 sm:py-7">
            <div className="h-7 w-44 rounded-xl bg-indigo-100/80 sm:h-10 sm:w-64" />
            <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-5 sm:grid-cols-6 sm:gap-3">
              {Array.from({ length: 6 }, (_, index) => <span key={index} className="h-20 rounded-2xl bg-white shadow-sm sm:h-28 sm:rounded-[1.5rem]" />)}
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:gap-4 sm:p-8 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => <span key={index} className="h-48 rounded-[1.6rem] border-2 border-indigo-50 bg-slate-50 sm:h-56 sm:rounded-[2rem]" />)}
          </div>
        </section>
      </main>
    </div>

    <footer className="min-h-[219px] border-t border-indigo-100 bg-white/90 px-4 py-6 text-center text-xs text-slate-400">
      <span className="font-bold">© 2026 AnnWord</span>
    </footer>
  </div>
);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {window.location.pathname.startsWith('/api/') ? (
        <FrontendApiFallback />
      ) : (
        <React.Suspense fallback={<AppBootShell />}>
          <AppRuntime />
        </React.Suspense>
      )}
    </ErrorBoundary>
  </React.StrictMode>
);
