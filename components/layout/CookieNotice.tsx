import React from 'react';
import { LEGAL_DOCUMENTS, LEGAL_LINK_PROPS } from '../../services/legalDocuments';

const COOKIE_NOTICE_STORAGE_KEY = 'annword:cookie-notice:v1';
const COOKIE_NOTICE_ACKNOWLEDGED = 'acknowledged';

const readAcknowledged = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) === COOKIE_NOTICE_ACKNOWLEDGED;
  } catch {
    return false;
  }
};

interface CookieNoticeProps {
  raiseAboveMobileNav?: boolean;
}

export const CookieNotice: React.FC<CookieNoticeProps> = ({ raiseAboveMobileNav = false }) => {
  const [visible, setVisible] = React.useState(() => !readAcknowledged());

  const acknowledge = () => {
    try {
      window.localStorage.setItem(COOKIE_NOTICE_STORAGE_KEY, COOKIE_NOTICE_ACKNOWLEDGED);
    } catch {
      // The notice may still be dismissed when storage is unavailable.
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <section
      aria-label="Уведомление об использовании cookie"
      className={`fixed inset-x-3 z-[70] mx-auto max-w-3xl rounded-2xl border border-indigo-100 bg-white/95 p-3 shadow-2xl backdrop-blur sm:inset-x-4 sm:p-4 ${raiseAboveMobileNav ? 'bottom-20 lg:bottom-4' : 'bottom-3 sm:bottom-4'}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-xs font-semibold leading-5 text-slate-600 sm:text-sm">
          Мы используем cookie для работы сайта и Яндекс Метрику для аналитики.{' '}
          <a href={LEGAL_DOCUMENTS.cookiePolicy} {...LEGAL_LINK_PROPS} className="font-bold text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900">
            Подробнее
          </a>
        </p>
        <button
          type="button"
          onClick={acknowledge}
          className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
        >
          Понятно
        </button>
      </div>
    </section>
  );
};

export default CookieNotice;
