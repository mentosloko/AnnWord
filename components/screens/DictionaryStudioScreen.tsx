import React, { useEffect, useMemo, useState } from 'react';
import { PremiumDictionaryDraft } from '../../services/premiumDictionaryService';
import { CustomDictionaryCollection, UserProfile } from '../../types';
import { analyzeEnglishWordList, formatEnglishWordList } from '../../utils/wordListParser';
import { ScreenContainer } from '../layout/ScreenContainer';

interface DictionaryStudioScreenProps {
  userProfile: UserProfile;
  onBack: () => void;
  onSaveDictionary: (draft: PremiumDictionaryDraft) => Promise<void>;
}

const latestCollection = (collections: CustomDictionaryCollection[] = []): CustomDictionaryCollection | undefined =>
  [...collections].sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))[0] || collections[0];

export const DictionaryStudioScreen: React.FC<DictionaryStudioScreenProps> = ({ userProfile, onBack, onSaveDictionary }) => {
  const isTeacher = userProfile.role === 'teacher' || userProfile.accountMode === 'teacher';
  const isKids = userProfile.role === 'parent' || userProfile.accountMode === 'parent';
  const lockedTitle = isKids ? 'Детские словари — в Kids Premium' : 'Личные словари — в Practice Premium';
  const lockedBody = isKids
    ? 'Premium взрослого открывает словари ребёнка, загрузку своих списков и словари от преподавателя.'
    : 'Practice Premium открывает личные, тематические и специальные словари для ежедневной взрослой практики.';
  const premiumNotExpired = !userProfile.premiumExpiresAt || Date.parse(userProfile.premiumExpiresAt) > Date.now();
  const canCreate = isTeacher || userProfile.role === 'admin' || (userProfile.subscriptionTier === 'premium' && premiumNotExpired);
  const activeTeacherCollection = isTeacher ? latestCollection(userProfile.dictionaryCollections || []) : undefined;
  const originalDraft = (isTeacher ? activeTeacherCollection?.words || [] : userProfile.customDictionaryEn).join('\n');
  const editorSourceKey = isTeacher ? activeTeacherCollection?.id || 'teacher-empty' : 'custom-dictionary';

  const [title, setTitle] = useState(activeTeacherCollection?.title || (isTeacher ? 'Словарь для ученика' : 'Мой словарь'));
  const [classLabel, setClassLabel] = useState(activeTeacherCollection?.classLabel || '');
  const [theme, setTheme] = useState(activeTeacherCollection?.theme || '');
  const [source, setSource] = useState<PremiumDictionaryDraft['source']>(activeTeacherCollection?.source || 'manual');
  const [draft, setDraft] = useState(originalDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setTitle(activeTeacherCollection?.title || (isTeacher ? 'Словарь для ученика' : 'Мой словарь'));
    setClassLabel(activeTeacherCollection?.classLabel || '');
    setTheme(activeTeacherCollection?.theme || '');
    setSource(activeTeacherCollection?.source || 'manual');
    setDraft(originalDraft);
  }, [activeTeacherCollection?.classLabel, activeTeacherCollection?.source, activeTeacherCollection?.theme, activeTeacherCollection?.title, editorSourceKey, isTeacher, originalDraft]);

  const preview = useMemo(() => analyzeEnglishWordList(draft), [draft]);
  const words = preview.words;

  const normalizeDraft = () => {
    const normalized = formatEnglishWordList(draft);
    if (normalized !== draft) setDraft(normalized);
  };

  const save = async () => {
    if (!canCreate) {
      setNotice('Создание собственных словарей доступно в Premium.');
      return;
    }
    if (!words.length) {
      setNotice('Добавьте хотя бы одно английское слово.');
      return;
    }
    setDraft(words.join('\n'));
    setIsSaving(true);
    try {
      await onSaveDictionary({
        title: title.trim() || (isTeacher ? 'Словарь для ученика' : 'Мой словарь'),
        words,
        source,
        classLabel: isTeacher ? classLabel.trim() || undefined : undefined,
        theme: isTeacher ? theme.trim() || undefined : undefined,
      });
      setNotice(isTeacher
        ? `Словарь «${title.trim() || 'Словарь для ученика'}» сохранён.`
        : 'Список очищен, сохранён и автоматически выбран для игр.');
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'Не удалось сохранить словарь.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetDraft = () => {
    setDraft(originalDraft);
    setSource(activeTeacherCollection?.source || 'manual');
    setNotice('Редактор возвращён к текущему сохранённому списку слов.');
  };

  return <ScreenContainer className="max-w-5xl pb-20">
    <header className="mb-5 flex items-center justify-between gap-3">
      <button type="button" aria-label="Назад" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button>
      <div className="text-center">
        <div className="text-xs font-black uppercase tracking-widest text-purple-500">{isTeacher ? 'AnnWord Teacher' : 'Premium'}</div>
        <h1 className="text-2xl font-black text-indigo-950 sm:text-3xl">{isTeacher ? 'Словарь преподавателя' : 'Мой словарь'}</h1>
      </div>
      <div className="rounded-full bg-purple-50 px-3 py-2 text-xs font-black text-purple-700">Слова</div>
    </header>

    {notice && <div role="status" aria-live="polite" className="mb-4 flex justify-between rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">
      <span>{notice}</span>
      <button type="button" aria-label="Закрыть сообщение" onClick={() => setNotice(null)}>×</button>
    </div>}

    {!canCreate && <div className="mb-5 rounded-3xl border-2 border-purple-100 bg-purple-50 p-5">
      <h2 className="text-xl font-black text-purple-950">{lockedTitle}</h2>
      <p className="mt-2 text-sm font-bold text-purple-700">{lockedBody}</p>
    </div>}

    {isTeacher && <div className="mb-5 rounded-3xl border-2 border-indigo-100 bg-indigo-50 p-5">
      <h2 className="text-xl font-black text-indigo-950">Словари для учеников</h2>
      <p className="mt-2 text-sm font-bold text-indigo-700">Редактор открывает последний сохранённый словарь преподавателя. Создайте или обновите список, затем назначьте его ученику в разделе «Ученики».</p>
      {activeTeacherCollection && <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs font-black text-indigo-700">Открыт словарь: {activeTeacherCollection.title}</p>}
    </div>}

    <main className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm">
      <div className="mb-5 rounded-3xl bg-indigo-50 p-4">
        <h2 className="text-xl font-black text-indigo-950">{isTeacher ? 'Соберите словарь для ученика' : 'Дополните текущий “Мой словарь”'}</h2>
        <p className="mt-2 text-sm font-bold text-indigo-700">
          {isTeacher
            ? 'Введите слова или вставьте готовый текст. Регистр, нумерация и разделители не важны — AnnWord сам очистит список.'
            : 'Введите слова вручную или вставьте текст, распознанный Алисой. AnnWord приведёт регистр к единому виду, уберёт разделители и дубликаты.'}
        </p>
      </div>

      {isTeacher && <div className="grid gap-3 sm:grid-cols-3">
        <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Название словаря" aria-label="Название словаря" className="rounded-xl border-2 border-indigo-100 px-3 py-2.5 font-bold text-indigo-950 sm:col-span-3" />
        <input value={classLabel} onChange={event => { setClassLabel(event.target.value); setSource('class'); }} placeholder="Класс: 3А" aria-label="Класс" className="rounded-xl border-2 border-indigo-100 px-3 py-2.5 font-bold" />
        <input value={theme} onChange={event => { setTheme(event.target.value); if (!classLabel) setSource('topic'); }} placeholder="Тема: Еда" aria-label="Тема словаря" className="rounded-xl border-2 border-indigo-100 px-3 py-2.5 font-bold" />
      </div>}

      {!isTeacher && <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4 text-sm font-bold text-purple-800">
        <div className="font-black">Как перенести слова с фотографии</div>
        <p className="mt-1">Отправьте фото Алисе и попросите: «Распознай английские слова. Выведи только слова без перевода и пояснений». Затем вставьте ответ в поле ниже.</p>
      </div>}

      <div className="mt-5"><h2 className="text-sm font-black uppercase tracking-widest text-indigo-400">Добавьте слова</h2></div>
      <textarea
        value={draft}
        onChange={event => { setDraft(event.target.value); if (!isTeacher) setSource('manual'); }}
        onBlur={normalizeDraft}
        placeholder={'Hi, KITE; fine / ride\nDRIVE | home • tree\nhouse, chair, table'}
        disabled={!canCreate}
        aria-label="Слова для словаря"
        className="mt-3 h-72 w-full rounded-2xl border-2 border-indigo-100 p-4 font-mono text-sm font-bold text-indigo-950 disabled:bg-gray-50 disabled:text-gray-400"
      />
      <section className="mt-4 rounded-3xl border-2 border-indigo-50 bg-indigo-50/50 p-4" aria-label="Предпросмотр словаря">
        <div className="text-xs font-black uppercase tracking-widest text-indigo-400">Проверка перед сохранением</div>
        <p className="mt-2 text-sm font-bold text-indigo-800">Подойдут пробелы, переносы строк, запятые, точки с запятой, слеши, тире, маркеры и нумерация. Сохранятся только английские слова.</p>
        {(preview.hasDuplicates || preview.outsideLength.length > 0) && <div className="mt-3 grid gap-2 text-xs font-bold text-gray-600 sm:grid-cols-2">
          {preview.hasDuplicates && <div className="rounded-2xl bg-white p-3">Дубликаты будут удалены автоматически.</div>}
          {preview.outsideLength.length > 0 && <div className="rounded-2xl bg-white p-3">Не подходят для игр 4–6 букв: <b>{preview.outsideLength.slice(0, 8).join(', ')}</b></div>}
        </div>}
      </section>
      <p className="mt-2 text-xs font-bold text-gray-500">При выходе из поля и при сохранении список автоматически преобразуется: одно слово — одна строка.</p>
      {!canCreate && <p className="mt-2 text-xs font-bold text-gray-500">Сохранение заблокировано до подключения Premium.</p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => void save()} disabled={!canCreate || isSaving || !words.length} className="rounded-xl bg-indigo-600 px-6 py-3 font-black text-white disabled:bg-gray-200 disabled:text-gray-400">{isSaving ? 'Сохраняю...' : isTeacher ? 'Сохранить словарь преподавателя' : 'Сохранить слова'}</button>
        <button type="button" onClick={resetDraft} disabled={!canCreate} className="rounded-xl border-2 border-indigo-100 px-5 py-3 font-black text-indigo-700 disabled:text-gray-300">Сбросить изменения</button>
        <button type="button" onClick={() => { setDraft(''); setSource('manual'); }} disabled={!canCreate} className="rounded-xl border-2 border-indigo-100 px-5 py-3 font-black text-indigo-700 disabled:text-gray-300">Очистить</button>
      </div>
    </main>
  </ScreenContainer>;
};
