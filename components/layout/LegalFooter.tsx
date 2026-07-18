import React from 'react';
import { LEGAL_DOCUMENTS, LEGAL_LINK_PROPS } from '../../services/legalDocuments';

const legalDocuments = [
  { label: 'Пользовательское соглашение', href: LEGAL_DOCUMENTS.userAgreement },
  { label: 'Публичная оферта', href: LEGAL_DOCUMENTS.publicOffer },
  { label: 'Политика обработки персональных данных', href: LEGAL_DOCUMENTS.privacyPolicy },
  { label: 'Cookie', href: LEGAL_DOCUMENTS.cookiePolicy },
];

export const LegalFooter: React.FC = () => (
  <footer className="border-t border-indigo-100 bg-white/90 px-4 py-6 text-center text-xs font-semibold leading-5 text-slate-500 backdrop-blur">
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-1.5">
      <p>© 2026 AnnWord</p>
      <p>ИП Манто Ирина Александровна, ИНН 771993411506, ОГРНИП 324774600764739</p>
      <a href="mailto:support@annword.ru" className="text-indigo-600 transition hover:text-indigo-800 hover:underline">support@annword.ru</a>
      <nav className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1" aria-label="Юридические документы">
        {legalDocuments.map((document, index) => (
          <React.Fragment key={document.href}>
            {index > 0 && <span aria-hidden="true">·</span>}
            <a href={document.href} {...LEGAL_LINK_PROPS} className="text-slate-600 transition hover:text-indigo-700 hover:underline">{document.label}</a>
          </React.Fragment>
        ))}
      </nav>
    </div>
  </footer>
);

export default LegalFooter;
