import React from 'react';

const legalDocumentLabels = [
  'Пользовательское соглашение',
  'Публичная оферта',
  'Политика обработки персональных данных',
  'Cookie',
];

export const LegalFooter: React.FC = () => (
  <footer className="border-t border-indigo-100 bg-white/90 px-4 py-6 text-center text-xs font-semibold leading-5 text-slate-500 backdrop-blur">
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-1.5">
      <p>© 2026 AnnWord</p>
      <p>ИП Иванов Иван Иванович, ИНН …, ОГРНИП …</p>
      <a href="mailto:support@annword.ru" className="text-indigo-600 transition hover:text-indigo-800 hover:underline">support@annword.ru</a>
      <nav className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1" aria-label="Юридические документы">
        {legalDocumentLabels.map((label, index) => (
          <React.Fragment key={label}>
            {index > 0 && <span aria-hidden="true">·</span>}
            <span title="Ссылка на документ будет добавлена позже" className="text-slate-600">{label}</span>
          </React.Fragment>
        ))}
      </nav>
    </div>
  </footer>
);

export default LegalFooter;
