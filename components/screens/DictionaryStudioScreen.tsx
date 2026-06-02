import React, { useMemo, useState } from 'react';
import { CustomDictionaryCollection, UserProfile } from '../../types';
import { browserOcrService } from '../../services/browserOcr';
import { ScreenContainer } from '../layout/ScreenContainer';

interface DictionaryStudioScreenProps {
  userProfile: UserProfile;
  onBack: () => void;
  onSaveDictionary: (words: string[]) => Promise<void> | void;
}

const parseWords = (value: string): string[] => Array.from(new Set(
  (value.match(/[A-Za-z][A-Za-z'-]{1,}/g) || []).map(word => word.toUpperCase()),
));

const STARTER_COLLECTIONS: CustomDictionaryCollection[] = [
  { id: 'grade-2-animals', title: '2 класс · Животные', source: 'class', classLabel: '2 класс', theme: 'Животные', words: ['CAT', 'DOG', 'FOX', 'HORSE', 'MOUSE'] },
  { id: 'grade-3-school', title: '3 класс · Школа', source: 'class', classLabel: '3 класс', theme: 'Школа', words: ['SCHOOL', 'PENCIL', 'TEACHER', 'LESSON', 'DESK'] },
  { id: 'topic-food', title: 'Тема · Еда', source: 'topic', theme: 'Еда', words: ['APPLE', 'BREAD', 'CHEESE', 'MILK', 'DINNER'] },
];

export const DictionaryStudioScreen: React.FC<DictionaryStudioScreenProps> = ({ userProfile, onBack, onSaveDictionary }) => {
  const premium = userProfile.subscriptionTier === 'premium' || ['admin', 'parent', 'teacher'].includes(userProfile.role || '');
  const collections = [...(userProfile.dictionaryCollections || []), ...STARTER_COLLECTIONS];
  const [title, setTitle] = useState('Новый словарь');
  const [classLabel, setClassLabel] = useState('');
  const [theme, setTheme] = useState('');
  const [draft, setDraft] = useState(userProfile.customDictionaryEn.join('\n'));
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const words = useMemo(() => parseWords(draft), [draft]);

  const loadCollection = (collection: CustomDictionaryCollection) => {
    setTitle(collection.title);
    setClassLabel(collection.classLabel || '');
    setTheme(collection.theme || '');
    setDraft(collection.words.join('\n'));
    setNotice(`Открыт словарь «${collection.title}». Отредактируйте его перед сохранением.`);
  };

  const runOcr = async (file: File | undefined) => {
    if (!file) return;
    setNotice(null);
    setOcrProgress(0);
    setOcrMessage('Подготавливаю распознавание...');
    try {
      const recognizedWords = await browserOcrService.recognizeWords(file, (percent, status) => {
        setOcrProgress(percent);
        setOcrMessage(status);
      });
      if (!recognizedWords.length) {
        setNotice('На фотографии не найдено английских слов. Попробуйте более чёткое изображение.');
        return;
      }
      setDraft(recognizedWords.join('\n'));
      setTitle('Словарь с фотографии');
      setNotice(`Распознано слов: ${recognizedWords.length}. Проверьте и отредактируйте список перед сохранением.`);
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'Не удалось распознать изображение.');
    } finally {
      setOcrProgress(null);
      setOcrMessage(null);
    }
  };

  const save = async () => {
    if (!premium) {
      setNotice('Создание собственных словарей доступно в Premium.');
      return;
    }
    if (!words.length) {
      setNotice('Добавьте хотя бы одно английское слово.');
      return;
    }
    await onSaveDictionary(words);
    setNotice(`Словарь «${title.trim() || 'Без названия'}» сохранён: ${words.length} слов.`);
  };

  return (
    <ScreenContainer className="max-w-6xl pb-20">
      <header className="mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button>
        <div className="text-center"><div className="text-xs font-black uppercase tracking-widest text-purple-500">Premium</div><h1 className="text-2xl font-black text-indigo-950 sm:text-3xl">Студия словарей</h1></div>
        <div className="rounded-full bg-purple-50 px-3 py-2 text-xs font-black text-purple-700">OCR</div>
      </header>
      {notice && <div className="mb-4 flex justify-between rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>×</button></div>}
      {!premium && <div className="mb-5 rounded-3xl border-2 border-purple-100 bg-purple-50 p-5"><h2 className="text-xl font-black text-purple-950">Собственные словари — в Premium</h2><p className="mt-2 text-sm font-bold text-purple-700">Сканируйте списки слов, собирайте темы и назначайте их ребёнку или классу.</p></div>}
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border-2 border-indigo-50 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-widest text-indigo-400">Готовые подборки</h2>
          <p className="mt-1 text-xs font-bold text-gray-500">Спотлайты по классам и темам</p>
          <div className="mt-4 space-y-2">{collections.map(collection => <button key={collection.id} type="button" onClick={() => loadCollection(collection)} className="w-full rounded-2xl border border-indigo-100 bg-white p-3 text-left hover:bg-indigo-50"><div className="font-black text-indigo-950">{collection.title}</div><div className="mt-1 text-xs font-bold text-indigo-400">{collection.words.length} слов</div></button>)}</div>
        </aside>
        <main className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3"><input value={title} onChange={event => setTitle(event.target.value)} placeholder="Название словаря" className="rounded-xl border-2 border-indigo-100 px-3 py-2.5 font-bold text-indigo-950 sm:col-span-3" /><input value={classLabel} onChange={event => setClassLabel(event.target.value)} placeholder="Класс: 3А" className="rounded-xl border-2 border-indigo-100 px-3 py-2.5 font-bold" /><input value={theme} onChange={event => setTheme(event.target.value)} placeholder="Тема: Еда" className="rounded-xl border-2 border-indigo-100 px-3 py-2.5 font-bold" /><label className="cursor-pointer rounded-xl border-2 border-dashed border-purple-200 bg-purple-50 px-3 py-2.5 text-center text-sm font-black text-purple-700"><input type="file" accept="image/*" className="hidden" onChange={event => void runOcr(event.target.files?.[0])} />📷 Распознать фото</label></div>
          {ocrProgress !== null && <div className="mt-4 rounded-2xl bg-purple-50 p-3"><div className="mb-2 flex justify-between text-xs font-black text-purple-700"><span>{ocrMessage}</span><span>{ocrProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-purple-100"><div className="h-full bg-purple-600" style={{ width: `${ocrProgress}%` }} /></div></div>}
          <div className="mt-5 flex items-center justify-between"><h2 className="text-sm font-black uppercase tracking-widest text-indigo-400">Редактирование перед сохранением</h2><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{words.length} слов</span></div>
          <textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder={'APPLE\nSCHOOL\nFRIEND'} className="mt-3 h-64 w-full rounded-2xl border-2 border-indigo-100 p-4 font-mono text-sm font-bold uppercase text-indigo-950" />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => void save()} disabled={!premium} className="rounded-xl bg-indigo-600 px-6 py-3 font-black text-white disabled:bg-gray-200 disabled:text-gray-400">Сохранить словарь</button><button type="button" onClick={() => setDraft('')} className="rounded-xl border-2 border-indigo-100 px-5 py-3 font-black text-indigo-700">Очистить</button></div>
        </main>
      </div>
    </ScreenContainer>
  );
};
