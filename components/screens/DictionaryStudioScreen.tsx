import React, { useEffect, useMemo, useState } from 'react';
import { browserOcrService } from '../../services/browserOcr';
import { resolveDictionaryWordTranslations, type DictionaryTranslationResolution } from '../../services/masterDictionaryLookup';
import { PremiumDictionaryDraft } from '../../services/premiumDictionaryService';
import { hasRussianTranslation } from '../../services/wordNormalization';
import { CustomDictionaryCollection, UserProfile } from '../../types';
import { useProfileFreshness } from '../../hooks/useProfileFreshness';
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
  return {
    hasDuplicates: valid.length !== unique.length,
    rejected: tokens.filter(token => !/^[A-Za-z][A-Za-z'-]{1,}$/.test(token)).slice(0, 20),
    outsideLength: unique.filter(word => word.length < 4 || word.length > 6),
  };
};
const latestCollection = (collections: CustomDictionaryCollection[] = []): CustomDictionaryCollection | undefined =>
  [...collections].sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))[0] || collections[0];

export const DictionaryStudioScreen: React.FC<DictionaryStudioScreenProps> = ({ userProfile, onBack, onSaveDictionary }) => {
  const profileFreshness = useProfileFreshness();
  const isTeacher = userProfile.role === 'teacher' || userProfile.accountMode === 'teacher';
  const isKids = userProfile.role === 'parent' || userProfile.accountMode === 'parent';
  const lockedTitle = isKids ? 'Детские словари — в Kids Premium' : 'Личные словари — в Practice Premium';
  const lockedBody = isKids
    ? 'Premium взрослого открывает словари ребёнка, загрузку своих списков и словари от преподавателя.'
    : 'Practice Premium открывает личные, тематические и специальные словари для ежедневной взрослой практики.';
  const premiumNotExpired = !userProfile.premiumExpiresAt || Date.parse(userProfile.premiumExpiresAt) > Date.now();
  const canCreate = isTeacher || userProfile.role === 'admin' || (userProfile.subscriptionTier === 'premium' && premiumNotExpired);
  const accessChecking = !canCreate && profileFreshness !== 'fresh';
  const canUseOcr = !isTeacher && canCreate;
  const activeTeacherCollection = isTeacher ? latestCollection(userProfile.dictionaryCollections || []) : undefined;
  const originalDraft = (isTeacher ? activeTeacherCollection?.words || [] : userProfile.customDictionaryEn).join('\n');
  const editorSourceKey = isTeacher ? activeTeacherCollection?.id || 'teacher-empty' : 'custom-dictionary';

  const [title, setTitle] = useState(activeTeacherCollection?.title || (isTeacher ? 'Словарь для ученика' : 'Мой словарь'));
  const [classLabel, setClassLabel] = useState(activeTeacherCollection?.classLabel || '');
  const [theme, setTheme] = useState(activeTeacherCollection?.theme || '');
  const [source, setSource] = useState<PremiumDictionaryDraft['source']>(activeTeacherCollection?.source || 'manual');
  const [draft, setDraft] = useState(originalDraft);
  const [manualTranslations, setManualTranslations] = useState<Record<string, string>>(activeTeacherCollection?.wordTranslations || {});
  const [translationResolution, setTranslationResolution] = useState<DictionaryTranslationResolution | null>(null);
  const [translationChecking, setTranslationChecking] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setTitle(activeTeacherCollection?.title || (isTeacher ? 'Словарь для ученика' : 'Мой словарь'));
    setClassLabel(activeTeacherCollection?.classLabel || '');
    setTheme(activeTeacherCollection?.theme || '');
    setSource(activeTeacherCollection?.source || 'manual');
    setDraft(originalDraft);
    setManualTranslations(activeTeacherCollection?.wordTranslations || {});
  }, [activeTeacherCollection?.classLabel, activeTeacherCollection?.source, activeTeacherCollection?.theme, activeTeacherCollection?.title, activeTeacherCollection?.wordTranslations, editorSourceKey, isTeacher, originalDraft]);

  const words = useMemo(() => parseWords(draft), [draft]);
  const wordsKey = words.join('|');
  const preview = useMemo(() => parsePreview(draft), [draft]);
  const teacherTitleError = isTeacher && !title.trim() ? 'Введите название словаря.' : null;
  const teacherWordsError = isTeacher && !words.length ? 'Добавьте хотя бы одно корректное английское слово.' : null;

  useEffect(() => {
    if (!isTeacher) {
      setTranslationResolution(null);
      setTranslationChecking(false);
      return;
    }
    let cancelled = false;
    setTranslationChecking(true);
    void resolveDictionaryWordTranslations(words, manualTranslations)
      .then(result => { if (!cancelled) setTranslationResolution(result); })
      .catch(() => { if (!cancelled) setTranslationResolution({ translations: {}, readyWords: [], canonicalWords: [], manualWords: [], missingWords: words }); })
      .finally(() => { if (!cancelled) setTranslationChecking(false); });
    return () => { cancelled = true; };
  }, [isTeacher, wordsKey, manualTranslations]);

  const editableTranslationWords = useMemo(() => {
    if (!isTeacher || !translationResolution) return [];
    const canonical = new Set(translationResolution.canonicalWords);
    return words.filter(word => !canonical.has(word));
  }, [isTeacher, translationResolution, wordsKey]);

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
      setNotice('Слова с фотографии добавлены. Проверьте список перед сохранением.');
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'Не удалось распознать изображение.');
    } finally {
      setOcrProgress(null);
      setOcrMessage(null);
    }
  };

  const save = async () => {
    if (accessChecking) {
      setNotice('Проверяем доступ к словарям. Сохранение станет доступно после ответа сервера.');
      return;
    }
    if (!canCreate) {
      setNotice('Создание собственных словарей доступно в Premium.');
      return;
    }
    if (teacherTitleError) { setNotice(teacherTitleError); return; }
    if (!words.length) {
      setNotice(teacherWordsError || 'Добавьте хотя бы одно английское слово.');
      return;
    }
    setIsSaving(true);
    try {
      const resolvedTranslations = isTeacher
        ? await resolveDictionaryWordTranslations(words, manualTranslations)
        : null;
      if (resolvedTranslations?.missingWords.length) {
        setTranslationResolution(resolvedTranslations);
        setNotice(`Добавьте русский перевод для: ${resolvedTranslations.missingWords.join(', ')}.`);
        return;
      }
      await onSaveDictionary({
        title: isTeacher ? title.trim() : title.trim() || 'Мой словарь',
        words,
        wordTranslations: resolvedTranslations?.translations,
        source,
        classLabel: isTeacher ? classLabel.trim() || undefined : undefined,
        theme: isTeacher ? theme.trim() || undefined : undefined,
      });
      setNotice(isTeacher
        ? `Словарь «${title.trim()}» сохранён.`
        : 'Мой словарь сохранён и автоматически выбран для игр.');
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'Не удалось сохранить словарь.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetDraft = () => {
    setDraft(originalDraft);
    setManualTranslations(activeTeacherCollection?.wordTranslations || {});
    setSource(activeTeacherCollection?.source || 'manual');
    setNotice('Редактор возвращён к текущему сохранённому списку слов.');
  };

  const teacherMissingCount = translationResolution?.missingWords.length || 0;
  const teacherReadyCount = translationResolution?.readyWords.length || 0;
  const teacherCanSave = !isTeacher || (!teacherTitleError && !teacherWordsError && !translationChecking && Boolean(translationResolution) && teacherMissingCount === 0);

  return <ScreenContainer className="max-w-5xl pb-20">
    <header className="mb-5 flex items-center justify-between gap-3">
      <button type="button" aria-label="Назад" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button>
      <div className="text-center">
        <div className="text-xs font-black uppercase tracking-widest text-purple-500">{isTeacher ? 'AnnWord Teacher' : 'Premium'}</div>
        <h1 className="text-2xl font-black text-indigo-950 sm:text-3xl">{isTeacher ? 'Словарь преподавателя' : 'Мой словарь'}</h1>
      </div>
      <div className="rounded-full bg-purple-50 px-3 py-2 text-xs font-black text-purple-700">{accessChecking ? 'Проверяем' : canUseOcr ? 'Фото' : isTeacher ? 'Словари' : 'Premium'}</div>
    </header>

    {notice && <div role="status" aria-live="polite" className="mb-4 flex justify-between rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">
      <span>{notice}</span>
      <button type="button" aria-label="Закрыть сообщение" onClick={() => setNotice(null)}>×</button>
    </div>}

    {accessChecking && <div role="status" aria-live="polite" className="mb-5 rounded-3xl border-2 border-indigo-100 bg-indigo-50 p-5">
      <h2 className="text-xl font-black text-indigo-950">Загружаем сохранённый словарь</h2>
      <p className="mt-2 text-sm font-bold text-indigo-700">Проверяем тариф и актуальные данные. До завершения проверки редактор остаётся только для чтения.</p>
    </div>}

    {!canCreate && !accessChecking && <div className="mb-5 rounded-3xl border-2 border-purple-100 bg-purple-50 p-5">
      <h2 className="text-xl font-black text-purple-950">{lockedTitle}</h2>
      <p className="mt-2 text-sm font-bold text-purple-700">{lockedBody}</p>
    </div>}

    {isTeacher && <div className="mb-5 rounded-3xl border-2 border-indigo-100 bg-indigo-50 p-5">
      <h2 className="text-xl font-black text-indigo-950">Словари для учеников</h2>
      <p className="mt-2 text-sm font-bold text-indigo-700">AnnWord сначала ищет каждое слово в основном и детском словарях. Если готового русского перевода нет, добавьте его вручную — только после этого слово попадёт в игры.</p>
      {activeTeacherCollection && <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs font-black text-indigo-700">Открыт словарь: {activeTeacherCollection.title}</p>}
    </div>}

    <main className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm">
      <div className="mb-5 rounded-3xl bg-indigo-50 p-4">
        <h2 className="text-xl font-black text-indigo-950">{isTeacher ? 'Соберите словарь для ученика' : 'Дополните текущий “Мой словарь”'}</h2>
        <p className="mt-2 text-sm font-bold text-indigo-700">{isTeacher ? 'Добавьте слова по одному в строке. Переводы из AnnWord подставятся автоматически; для неизвестных слов появятся поля ниже.' : 'В редакторе уже открыт текущий список. Добавьте новые слова, удалите лишние и сохраните — этот список будет использоваться в играх как “Мой словарь”.'}</p>
      </div>

      <div className={`grid gap-3 ${isTeacher ? 'sm:grid-cols-3' : ''}`}>
        {isTeacher && <>
          <label className="sm:col-span-3"><span className="mb-1 block text-sm font-black text-indigo-950">Название словаря</span><input value={title} onChange={event => setTitle(event.target.value)} placeholder="Например, Unit 5" required aria-invalid={Boolean(teacherTitleError)} aria-describedby={teacherTitleError ? 'teacher-dictionary-title-error' : undefined} disabled={accessChecking} className={`w-full rounded-xl border-2 px-3 py-2.5 font-bold text-indigo-950 disabled:bg-gray-50 ${teacherTitleError ? 'border-rose-300 bg-rose-50' : 'border-indigo-100'}`} />{teacherTitleError && <span id="teacher-dictionary-title-error" role="alert" className="mt-1 block text-xs font-bold text-rose-600">{teacherTitleError}</span>}</label>
          <input value={classLabel} onChange={event => { setClassLabel(event.target.value); setSource('class'); }} placeholder="Класс: 3А" aria-label="Класс" disabled={accessChecking} className="rounded-xl border-2 border-indigo-100 px-3 py-2.5 font-bold disabled:bg-gray-50" />
          <input value={theme} onChange={event => { setTheme(event.target.value); if (!classLabel) setSource('topic'); }} placeholder="Тема: Еда" aria-label="Тема словаря" disabled={accessChecking} className="rounded-xl border-2 border-indigo-100 px-3 py-2.5 font-bold disabled:bg-gray-50" />
        </>}
        {canUseOcr
          ? <label className="cursor-pointer rounded-xl border-2 border-dashed border-purple-200 bg-purple-50 px-3 py-2.5 text-center text-sm font-black text-purple-700"><input type="file" accept="image/*" className="hidden" onChange={event => void runOcr(event.target.files?.[0])} />📷 Добавить слова с фото</label>
          : <div aria-disabled="true" className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-sm font-black text-gray-400" title={accessChecking ? 'Проверяем доступ' : isTeacher ? 'OCR для преподавателя появится позднее' : 'OCR доступен в Premium'}>{accessChecking ? '⏳ Проверяем доступ' : '📷 OCR позже'}</div>}
      </div>

      {ocrProgress !== null && <div className="mt-4 rounded-2xl bg-purple-50 p-3"><div className="mb-2 flex justify-between text-xs font-black text-purple-700"><span>{ocrMessage}</span><span>{ocrProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-purple-100"><div className="h-full bg-purple-600" style={{ width: `${ocrProgress}%` }} /></div></div>}

      <div className="mt-5"><label htmlFor="dictionary-word-list" className="text-sm font-black uppercase tracking-widest text-indigo-400">Список слов</label></div>
      <textarea id="dictionary-word-list" value={draft} onChange={event => setDraft(event.target.value)} placeholder={'APPLE\nSCHOOL\nFRIEND'} required disabled={!canCreate || accessChecking} aria-invalid={Boolean(teacherWordsError)} aria-describedby={teacherWordsError ? 'teacher-dictionary-words-error' : 'dictionary-words-help'} className={`mt-3 h-72 w-full rounded-2xl border-2 p-4 font-mono text-sm font-bold uppercase text-indigo-950 disabled:bg-gray-50 disabled:text-gray-400 ${teacherWordsError ? 'border-rose-300 bg-rose-50' : 'border-indigo-100'}`} />
      {teacherWordsError && <p id="teacher-dictionary-words-error" role="alert" className="mt-2 text-xs font-bold text-rose-600">{teacherWordsError}</p>}

      {isTeacher && words.length > 0 && <section className="mt-4 rounded-3xl border-2 border-emerald-100 bg-emerald-50/60 p-4" aria-label="Готовность словаря к играм">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-black uppercase tracking-widest text-emerald-700">Готовность к играм</div><p className="mt-1 text-sm font-bold text-slate-600">Перевод проверяется до сохранения и ещё раз на сервере перед назначением.</p></div>{translationChecking ? <span role="status" className="rounded-full bg-white px-3 py-2 text-xs font-black text-indigo-600">Проверяем…</span> : <div className="flex gap-2"><span className="rounded-full bg-white px-3 py-2 text-xs font-black text-emerald-700">Готовы: {teacherReadyCount}</span><span className={`rounded-full bg-white px-3 py-2 text-xs font-black ${teacherMissingCount ? 'text-rose-700' : 'text-emerald-700'}`}>Нужен перевод: {teacherMissingCount}</span></div>}</div>
        {!translationChecking && translationResolution && translationResolution.canonicalWords.length > 0 && <div className="mt-3 rounded-2xl bg-white p-3 text-xs font-bold text-emerald-800">Из словаря AnnWord: {translationResolution.canonicalWords.slice(0, 10).map(word => `${word} — ${translationResolution.translations[word]}`).join(' · ')}{translationResolution.canonicalWords.length > 10 ? '…' : ''}</div>}
        {!translationChecking && editableTranslationWords.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{editableTranslationWords.map(word => { const value = manualTranslations[word] || ''; const invalid = Boolean(value.trim()) && !hasRussianTranslation(value); return <label key={word} className="rounded-2xl bg-white p-3"><span className="block text-sm font-black text-indigo-950">{word}</span><span className="mt-1 block text-xs font-bold text-slate-500">Русский перевод</span><input value={value} onChange={event => setManualTranslations(previous => ({ ...previous, [word]: event.target.value }))} placeholder="Введите перевод" aria-label={`Русский перевод для ${word}`} aria-invalid={invalid || undefined} className={`mt-2 w-full rounded-xl border-2 px-3 py-2 text-sm font-bold outline-none ${invalid ? 'border-rose-300 bg-rose-50' : 'border-indigo-100 focus:border-indigo-400'}`} />{invalid && <span className="mt-1 block text-xs font-bold text-rose-600">Перевод должен содержать русские буквы.</span>}</label>; })}</div>}
        {!translationChecking && teacherMissingCount === 0 && teacherReadyCount > 0 && teacherReadyCount < 3 && <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Словарь можно сохранить, но для назначения ученику нужно минимум 3 игровых слова с переводом.</p>}
      </section>}

      <section className="mt-4 rounded-3xl border-2 border-indigo-50 bg-indigo-50/50 p-4" aria-label="Предпросмотр словаря"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">Проверка перед сохранением</div><p className="mt-2 text-sm font-bold text-indigo-800">Слова из 4–6 букв будут использоваться во всех игровых режимах с ограничением длины. Остальные останутся доступны в режимах без ограничения.</p>{(preview.hasDuplicates || preview.rejected.length > 0 || preview.outsideLength.length > 0) && <div className="mt-3 grid gap-2 text-xs font-bold text-gray-600 sm:grid-cols-3">{preview.hasDuplicates && <div className="rounded-2xl bg-white p-3">Дубликаты будут удалены автоматически.</div>}{preview.rejected.length > 0 && <div className="rounded-2xl bg-white p-3">Некорректные элементы: <b>{preview.rejected.join(', ')}</b></div>}{preview.outsideLength.length > 0 && <div className="rounded-2xl bg-white p-3">Не подходят для игр 4–6 букв: <b>{preview.outsideLength.slice(0, 8).join(', ')}</b></div>}</div>}</section>
      <p id="dictionary-words-help" className="mt-2 text-xs font-bold text-gray-500">Можно вставить слова списком, через пробел или из учебника: приложение само оставит английские слова и уберёт дубликаты.</p>
      {accessChecking ? <p className="mt-2 text-xs font-bold text-indigo-500">Сохранение станет доступно после проверки профиля.</p> : !canCreate && <p className="mt-2 text-xs font-bold text-gray-500">Сохранение заблокировано до подключения Premium.</p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => void save()} disabled={!canCreate || accessChecking || isSaving || !words.length || !teacherCanSave} className="rounded-xl bg-indigo-600 px-6 py-3 font-black text-white disabled:bg-gray-200 disabled:text-gray-400">{isSaving ? 'Сохраняю...' : isTeacher ? 'Сохранить словарь преподавателя' : 'Сохранить мой словарь'}</button>
        <button type="button" onClick={resetDraft} disabled={!canCreate || accessChecking} className="rounded-xl border-2 border-indigo-100 px-5 py-3 font-black text-indigo-700 disabled:text-gray-300">Сбросить изменения</button>
        <button type="button" onClick={() => { setDraft(''); setManualTranslations({}); setSource('manual'); }} disabled={!canCreate || accessChecking} className="rounded-xl border-2 border-indigo-100 px-5 py-3 font-black text-indigo-700 disabled:text-gray-300">Очистить</button>
      </div>
    </main>
  </ScreenContainer>;
};