import React, { useMemo, useState } from 'react';
import { browserOcrService } from '../../services/browserOcr';
import { PremiumDictionaryDraft } from '../../services/premiumDictionaryService';
import { UserProfile } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface DictionaryStudioScreenProps {
  userProfile: UserProfile;
  onBack: () => void;
  onSaveDictionary: (draft: PremiumDictionaryDraft) => Promise<void>;
}

const wordRegex = /[A-Za-z][A-Za-z'-]{1,}/g;
const parseWords = (value: string): string[] => Array.from(new Set(
  (value.match(wordRegex) || []).map(word => word.toUpperCase()),
));
const parsePreview = (value: string) => {
  const tokens = value.split(/[^A-Za-z'-]+/).map(item => item.trim()).filter(Boolean);
  const valid = tokens.filter(token => /^[A-Za-z][A-Za-z'-]{1,}$/.test(token)).map(token => token.toUpperCase());
  const unique = Array.from(new Set(valid));
  const duplicates = Math.max(0, valid.length - unique.length);
  const rejected = tokens.filter(token => !/^[A-Za-z][A-Za-z'-]{1,}$/.test(token)).slice(0, 20);
  const playable = unique.filter(word => word.length >= 4 && word.length <= 6);
  const outsideLength = unique.filter(word => word.length < 4 || word.length > 6);
  return {
    unique,
    duplicates,
    rejected,
    outsideLength,
    buckets: {
      four: unique.filter(word => word.length === 4).length,
      five: unique.filter(word => word.length === 5).length,
      six: unique.filter(word => word.length === 6).length,
      other: outsideLength.length,
    },
    playableCount: playable.length,
  };
};

export const DictionaryStudioScreen: React.FC<DictionaryStudioScreenProps> = ({ userProfile, onBack, onSaveDictionary }) => {
  const isTeacher = userProfile.role === 'teacher' || userProfile.accountMode === 'teacher';
  const isKids = userProfile.role === 'parent' || userProfile.accountMode === 'parent';
  const lockedTitle = isKids ? 'Детские словари — в Kids Premium' : 'Личные словари — в Practice Premium';
  const lockedBody = isKids
    ? 'Premium взрослого открывает словари ребёнка, загрузку своих списков и словари от преподавателя.'
    : 'Practice Premium открывает личные, тематические и специальные словари для ежедневной взрослой практики.';
  const premiumNotExpired = !userProfile.premiumExpiresAt || Date.parse(userProfile.premiumExpiresAt) > Date.now();
  const canCreate = isTeacher || userProfile.role === 'admin' || (userProfile.subscriptionTier === 'premium' && premiumNotExpired);
  const canUseOcr = !isTeacher && canCreate;
  const originalDraft = userProfile.customDictionaryEn.join('\n');

  const [title, setTitle] = useState(isTeacher ? 'Словарь для ученика' : 'Мой словарь');
  const [classLabel, setClassLabel] = useState('');
  const [theme, setTheme] = useState('');
  const [source, setSource] = useState<PremiumDictionaryDraft['source']>('manual');
  const [draft, setDraft] = useState(originalDraft);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const words = useMemo(() => parseWords(draft), [draft]);
  const preview = useMemo(() => parsePreview(draft), [draft]);
  const originalWords = useMemo(() => parseWords(originalDraft), [originalDraft]);
  const originalWordSet = useMemo(() => new Set(originalWords), [originalWords]);
  const currentWordSet = useMemo(() => new Set(words), [words]);
  const addedWordCount = words.filter(word => !originalWordSet.has(word)).length;
  const removedWordCount = originalWords.filter(word => !currentWordSet.has(word)).length;

  const runOcr = async (file: File | undefined) => {
    if (!file || !canUseOcr) return;
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
      const mergedWords = Array.from(new Set([...words, ...recognizedWords.map(word => word.toUpperCase())]));
      setDraft(mergedWords.join('\n'));
      setTitle(isTeacher ? 'Словарь для ученика' : 'Мой словарь');
      setSource('ocr');
      setNotice(`Добавлено слов с фотографии: ${mergedWords.length - words.length}. Проверьте список перед сохранением.`);
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'Не удалось распознать изображение.');
    } finally {
      setOcrProgress(null);
      setOcrMessage(null);
    }
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
        ? `Словарь «${title.trim() || 'Словарь для ученика'}» сохранён: ${words.length} слов.`
        : `Мой словарь сохранён: ${words.length} слов. Он автоматически выбран для игр.`);
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'Не удалось сохранить словарь.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetDraft = () => {
    setDraft(originalDraft);
    setSource('manual');
    setNotice('Редактор возвращён к текущему сохранённому списку слов.');
  };

  return <ScreenContainer className="max-w-5xl pb-20">
    <header className="mb-5 flex items-center justify-between gap-3">
      <button type="button" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button>
      <div className="text-center">
        <div className="text-xs font-black uppercase tracking-widest text-purple-500">{isTeacher ? 'AnnWord Teacher' : 'Premium'}</div>
        <h1 className="text-2xl font-black text-indigo-950 sm:text-3xl">{isTeacher ? 'Словарь для ученика' : 'Мой словарь'}</h1>
      </div>
      <div className="rounded-full bg-purple-50 px-3 py-2 text-xs font-black text-purple-700">{canUseOcr ? 'Фото' : isTeacher ? 'OCR позже' : 'Premium'}</div>
    </header>

    {notice && <div role="status" aria-live="polite" className="mb-4 flex justify-between rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">
      <span>{notice}</span>
      <button type="button" onClick={() => setNotice(null)}>×</button>
    </div>}

    {!canCreate && <div className="mb-5 rounded-3xl border-2 border-purple-100 bg-purple-50 p-5">
      <h2 className="text-xl font-black text-purple-950">{lockedTitle}</h2>
      <p className="mt-2 text-sm font-bold text-purple-700">{lockedBody}</p>
    </div>}

    {isTeacher && <div className="mb-5 rounded-3xl border-2 border-indigo-100 bg-indigo-50 p-5">
      <h2 className="text-xl font-black text-indigo-950">Словари для учеников</h2>
      <p className="mt-2 text-sm font-bold text-indigo-700">Создайте список вручную, сохраните его и назначьте подключённому ученику в кабинете преподавателя. Распознавание фото для преподавателя появится позднее.</p>
    </div>}

    <main className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm">
      <div className="mb-5 rounded-3xl bg-indigo-50 p-4">
        <h2 className="text-xl font-black text-indigo-950">{isTeacher ? 'Соберите словарь для ученика' : 'Дополните текущий “Мой словарь”'}</h2>
        <p className="mt-2 text-sm font-bold text-indigo-700">
          {isTeacher
            ? 'Добавьте слова в редактор, по одному слову в строке. После сохранения словарь можно будет назначить ученику.'
            : 'В редакторе уже открыт текущий список. Добавьте новые слова, удалите лишние и сохраните — этот список будет использоваться в играх как “Мой словарь”.'}
        </p>
        <div className="mt-4 grid gap-2 text-center text-xs font-black text-indigo-700 sm:grid-cols-3">
          <div className="rounded-2xl bg-white px-3 py-2">Сейчас сохранено: {originalWords.length}</div>
          <div className="rounded-2xl bg-white px-3 py-2">В редакторе: {words.length}</div>
          <div className="rounded-2xl bg-white px-3 py-2">Новых: {addedWordCount}{removedWordCount > 0 ? ` · удалено: ${removedWordCount}` : ''}</div>
        </div>
      </div>

      <div className={`grid gap-3 ${isTeacher ? 'sm:grid-cols-3' : ''}`}>
        {isTeacher && <>
          <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Название словаря" className="rounded-xl border-2 border-indigo-100 px-3 py-2.5 font-bold text-indigo-950 sm:col-span-3" />
          <input value={classLabel} onChange={event => { setClassLabel(event.target.value); setSource('class'); }} placeholder="Класс: 3А" className="rounded-xl border-2 border-indigo-100 px-3 py-2.5 font-bold" />
          <input value={theme} onChange={event => { setTheme(event.target.value); if (!classLabel) setSource('topic'); }} placeholder="Тема: Еда" className="rounded-xl border-2 border-indigo-100 px-3 py-2.5 font-bold" />
        </>}
        {canUseOcr
          ? <label className="cursor-pointer rounded-xl border-2 border-dashed border-purple-200 bg-purple-50 px-3 py-2.5 text-center text-sm font-black text-purple-700">
              <input type="file" accept="image/*" className="hidden" onChange={event => void runOcr(event.target.files?.[0])} />📷 Добавить слова с фото
            </label>
          : <div aria-disabled="true" className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-sm font-black text-gray-400" title={isTeacher ? 'OCR для преподавателя появится позднее' : 'OCR доступен в Premium'}>📷 OCR позже</div>}
      </div>

      {ocrProgress !== null && <div className="mt-4 rounded-2xl bg-purple-50 p-3">
        <div className="mb-2 flex justify-between text-xs font-black text-purple-700"><span>{ocrMessage}</span><span>{ocrProgress}%</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-purple-100"><div className="h-full bg-purple-600" style={{ width: `${ocrProgress}%` }} /></div>
      </div>}

      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest text-indigo-400">Список слов</h2>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{words.length} слов</span>
      </div>
      <textarea
        value={draft}
        onChange={event => setDraft(event.target.value)}
        placeholder={'APPLE\nSCHOOL\nFRIEND'}
        disabled={!canCreate}
        className="mt-3 h-72 w-full rounded-2xl border-2 border-indigo-100 p-4 font-mono text-sm font-bold uppercase text-indigo-950 disabled:bg-gray-50 disabled:text-gray-400"
      />
      <section className="mt-4 rounded-3xl border-2 border-indigo-50 bg-indigo-50/50 p-4" aria-label="Предпросмотр словаря">
        <div className="text-xs font-black uppercase tracking-widest text-indigo-400">Предпросмотр перед сохранением</div>
        <div className="mt-3 grid gap-2 text-center text-xs font-black text-indigo-800 sm:grid-cols-5">
          <div className="rounded-2xl bg-white px-3 py-2">Игровых 4–6: {preview.playableCount}</div>
          <div className="rounded-2xl bg-white px-3 py-2">4 буквы: {preview.buckets.four}</div>
          <div className="rounded-2xl bg-white px-3 py-2">5 букв: {preview.buckets.five}</div>
          <div className="rounded-2xl bg-white px-3 py-2">6 букв: {preview.buckets.six}</div>
          <div className="rounded-2xl bg-white px-3 py-2">Вне 4–6: {preview.buckets.other}</div>
        </div>
        {(preview.duplicates > 0 || preview.rejected.length > 0 || preview.outsideLength.length > 0) && <div className="mt-3 grid gap-2 text-xs font-bold text-gray-600 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-3">Дубликатов убрано: <b>{preview.duplicates}</b></div>
          <div className="rounded-2xl bg-white p-3">Отброшено токенов: <b>{preview.rejected.length}</b>{preview.rejected.length ? ` · ${preview.rejected.join(', ')}` : ''}</div>
          <div className="rounded-2xl bg-white p-3">Не будут в Wordle 4–6: <b>{preview.outsideLength.length}</b>{preview.outsideLength.length ? ` · ${preview.outsideLength.slice(0, 8).join(', ')}` : ''}</div>
        </div>}
      </section>
      <p className="mt-2 text-xs font-bold text-gray-500">Можно вставить слова списком, через пробел или из учебника: приложение само оставит английские слова и уберёт дубликаты.</p>
      {!canCreate && <p className="mt-2 text-xs font-bold text-gray-500">Сохранение заблокировано до подключения Premium.</p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => void save()} disabled={!canCreate || isSaving || !words.length} className="rounded-xl bg-indigo-600 px-6 py-3 font-black text-white disabled:bg-gray-200 disabled:text-gray-400">{isSaving ? 'Сохраняю...' : isTeacher ? 'Сохранить словарь преподавателя' : 'Сохранить мой словарь'}</button>
        <button type="button" onClick={resetDraft} disabled={!canCreate} className="rounded-xl border-2 border-indigo-100 px-5 py-3 font-black text-indigo-700 disabled:text-gray-300">Сбросить изменения</button>
        <button type="button" onClick={() => { setDraft(''); setSource('manual'); }} disabled={!canCreate} className="rounded-xl border-2 border-indigo-100 px-5 py-3 font-black text-indigo-700 disabled:text-gray-300">Очистить</button>
      </div>
    </main>
  </ScreenContainer>;
};