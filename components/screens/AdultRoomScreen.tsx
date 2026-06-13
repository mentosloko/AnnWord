import React, { useEffect, useMemo, useState } from 'react';
import { familyAccountService } from '../../services/familyAccountService';
import { mentorRoomService } from '../../services/mentorRoomService';
import { ManagedLearner, UserProfile, WordPerformance } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface Props { userProfile: UserProfile; onBackHome: () => void; onOpenDictionaryStudio: () => void; }
const accuracy = (word: WordPerformance) => word.attempts ? Math.round(word.correct / word.attempts * 100) : 0;
const wordAttempts = (word: WordPerformance) => Math.max(0, Math.round(word.attempts || 0));
const learnedWord = (word: WordPerformance) => word.correct > 0 && accuracy(word) >= 80;

export const AdultRoomScreen: React.FC<Props> = ({ userProfile, onBackHome, onOpenDictionaryStudio }) => {
  const isTeacher = userProfile.role === 'teacher' || userProfile.accountMode === 'teacher';
  const isParent = userProfile.role === 'parent' || userProfile.accountMode === 'parent';
  const premiumActive = userProfile.role === 'admin' || (userProfile.subscriptionTier === 'premium' && (!userProfile.premiumExpiresAt || Date.parse(userProfile.premiumExpiresAt) > Date.now()));
  const [unlocked, setUnlocked] = useState(!isParent || isTeacher);
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [learners, setLearners] = useState<ManagedLearner[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const learner = learners.find(item => item.id === selectedId) || learners[0];
  const collections = userProfile.dictionaryCollections || [];
  const wordStats = useMemo(() => Object.values(learner?.stats.wordPerformance || {}).sort((a, b) => accuracy(a) - accuracy(b)), [learner]);
  const encounteredWords = wordStats.filter(word => wordAttempts(word) > 0);
  const learnedWords = encounteredWords.filter(learnedWord);
  const errorWords = encounteredWords.filter(word => word.mistakes > 0);
  const normalizedCode = code.trim().toUpperCase();

  const load = async () => {
    setBusy(true);
    try {
      const result = await mentorRoomService.loadLearners();
      setLearners(result.learners);
      setSelectedId(result.learners[0]?.id || '');
      if (!result.backendReady) setNotice('Новая схема данных ещё не применена.');
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'Не удалось загрузить данные.');
    } finally { setBusy(false); }
  };
  useEffect(() => { if (unlocked || isTeacher) void load(); }, [unlocked, isTeacher]);

  const unlock = async () => {
    if (!/^\d{4}$/.test(pin)) { setNotice('Введите PIN из 4 цифр.'); return; }
    setBusy(true);
    try { const ok = await familyAccountService.verifyParentPin(pin); if (ok) { setUnlocked(true); setNotice(null); } else setNotice('Неверный PIN.'); }
    catch (error: unknown) { setNotice(error instanceof Error ? error.message : 'Не удалось проверить PIN.'); }
    finally { setBusy(false); }
  };
  const connect = async () => {
    if (!normalizedCode) { setNotice('Введите код ребёнка.'); return; }
    setBusy(true);
    try { await mentorRoomService.connectByChildCode(normalizedCode); setCode(''); setNotice('Ученик подключён.'); await load(); }
    catch (error: unknown) { setNotice(error instanceof Error ? error.message : 'Не удалось подключить ученика.'); }
    finally { setBusy(false); }
  };
  const assign = async () => {
    if (!learner || !collectionId) return;
    setBusy(true);
    try { await mentorRoomService.assignCollection(learner.id, collectionId); setNotice('Словарь назначен ученику.'); await load(); }
    catch (error: unknown) { setNotice(error instanceof Error ? error.message : 'Не удалось назначить словарь.'); }
    finally { setBusy(false); }
  };
  const copyChildCode = async (childCode: string) => {
    try { await navigator.clipboard.writeText(childCode); setNotice('Код скопирован. Передайте его преподавателю.'); }
    catch { setNotice('Не удалось скопировать код. Скопируйте его вручную.'); }
  };

  if (isParent && !isTeacher && !unlocked) return <ScreenContainer className="max-w-md pb-20"><button type="button" onClick={onBackHome} className="mb-5 rounded-xl border-2 border-indigo-100 px-4 py-2 font-bold text-indigo-700">← Назад</button><section className="rounded-[2rem] bg-white p-6 shadow-sm"><h1 className="text-2xl font-black text-indigo-950">Кабинет родителя</h1><p className="mt-2 text-sm font-bold text-gray-500">Введите PIN, созданный при добавлении ребёнка на этом устройстве.</p><div className="mt-4 rounded-2xl bg-indigo-50 p-3 text-xs font-bold text-indigo-700">PIN нужен, чтобы ребёнок случайно не попал в кабинет взрослого. Если PIN забыт, выйдите из аккаунта и войдите заново как родитель — позже здесь появится отдельная смена PIN.</div>{notice && <p id="parent-pin-error" role="alert" aria-live="assertive" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{notice}</p>}<input value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g, '').slice(0, 4)); if (notice) setNotice(null); }} type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" aria-describedby={notice ? 'parent-pin-error parent-pin-help' : 'parent-pin-help'} placeholder="••••" className="mt-5 w-full rounded-xl border-2 border-indigo-100 p-3 text-center text-xl font-black" /><p id="parent-pin-help" className="mt-2 text-center text-xs font-bold text-gray-400">4 цифры. Только для этого устройства.</p><button type="button" disabled={busy} onClick={() => void unlock()} className="mt-4 w-full rounded-xl bg-indigo-600 p-3 font-black text-white">Открыть</button></section></ScreenContainer>;

  return <ScreenContainer className="max-w-6xl pb-20"><header className="mb-5 flex items-center justify-between gap-3"><button type="button" onClick={onBackHome} className="rounded-xl border-2 border-indigo-100 px-4 py-2 font-bold text-indigo-700">←</button><div className="text-center"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">{isTeacher ? 'AnnWord Teacher' : 'AnnWord Kids'}</div><h1 className="text-xl font-black text-indigo-950 sm:text-3xl">{isTeacher ? 'Кабинет преподавателя' : 'Кабинет родителя'}</h1></div>{isTeacher || premiumActive ? <button type="button" onClick={onOpenDictionaryStudio} className="rounded-xl bg-indigo-600 px-4 py-2 font-black text-white">Словари</button> : <button type="button" onClick={onOpenDictionaryStudio} className="rounded-xl bg-purple-50 px-3 py-2 text-xs font-black text-purple-700">Словари · Premium</button>}</header>{notice && <p role="status" aria-live="polite" className="mb-4 rounded-xl bg-indigo-50 p-3 text-sm font-bold text-indigo-700">{notice}</p>}{isTeacher && <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm"><h2 className="font-black text-indigo-950">Подключить ученика по коду</h2><p className="mt-1 text-sm font-bold text-gray-500">Родитель создаёт код в детском кабинете. Введите код, чтобы видеть прогресс и назначать словари.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="Код ребёнка" className="min-w-0 flex-1 rounded-xl border-2 border-indigo-100 px-3 py-2 font-black" /><button type="button" disabled={busy || !normalizedCode} onClick={() => void connect()} className="rounded-xl bg-indigo-600 px-4 py-3 font-black text-white disabled:bg-gray-200 disabled:text-gray-400">Подключить</button></div></section>}<div className="grid gap-5 lg:grid-cols-[280px_1fr]"><aside className="rounded-3xl bg-white p-4 shadow-sm"><h2 className="mb-3 text-xs font-black uppercase text-indigo-400">{isTeacher ? 'Ученики' : 'Ребёнок'}</h2>{busy && !learners.length ? <p>Загружаю...</p> : learners.length ? learners.map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} aria-pressed={selectedId === item.id} className={`mb-2 w-full rounded-xl p-3 text-left font-black ${selectedId === item.id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-950'}`}>{item.name}</button>) : <div className="rounded-xl bg-indigo-50 p-3 text-sm font-bold text-indigo-700">{isTeacher ? <><p>Пока нет подключённых учеников.</p><p className="mt-2">Введите код ребёнка в блоке выше — список появится здесь.</p></> : 'Профиль ребёнка не найден.'}</div>}{!isTeacher && learner?.childShareCode && <div className="mt-4 rounded-xl bg-purple-50 p-3"><div className="text-xs font-black text-purple-500">КОД ДЛЯ ПРЕПОДАВАТЕЛЯ</div><div className="mt-2 text-center text-xl font-black tracking-widest text-purple-800">{learner.childShareCode}</div><p className="mt-2 text-xs font-bold text-purple-700">Передайте этот код учителю, чтобы он видел прогресс ребёнка и мог назначать словари.</p><button type="button" onClick={() => void copyChildCode(learner.childShareCode || '')} className="mt-3 w-full rounded-xl bg-purple-600 px-3 py-2 text-sm font-black text-white">Скопировать код</button></div>}<div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm font-black text-gray-500">Отчёт за неделю<br /><span className="font-bold">Появится после 3 тренировок.</span></div></aside>{learner ? <main className="space-y-4"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['ИГР', learner.stats.gamesPlayed], ['ПОБЕД', learner.stats.gamesWon], ['СЛОВ ВСТРЕТИЛОСЬ', encounteredWords.length], ['ОШИБОЧНЫХ', errorWords.length]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-white p-4 shadow-sm"><div className="text-xs font-black text-indigo-400">{label}</div><div className="text-3xl font-black">{value}</div></div>)}</div><div className="grid grid-cols-2 gap-3 md:grid-cols-3"><div className="rounded-2xl bg-white p-4 shadow-sm"><div className="text-xs font-black text-indigo-400">ВЫУЧЕНО</div><div className="text-3xl font-black">{learnedWords.length}</div></div><div className="rounded-2xl bg-white p-4 shadow-sm"><div className="text-xs font-black text-indigo-400">АКТИВНЫЙ СЛОВАРЬ</div><div className="text-3xl font-black">{learner.assignedWords.length || userProfile.customDictionaryEn.length}</div></div></div>{isTeacher && <section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="font-black">Назначить сохранённый словарь</h2><div className="mt-3 flex gap-2"><select value={collectionId} onChange={event => setCollectionId(event.target.value)} className="min-w-0 flex-1 rounded-xl border-2 border-indigo-100 p-2 font-bold"><option value="">Выберите подборку</option>{collections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button type="button" disabled={!collectionId || busy} onClick={() => void assign()} className="rounded-xl bg-indigo-600 px-4 font-black text-white disabled:bg-gray-200 disabled:text-gray-400">Назначить</button></div></section>}<section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="font-black">Ошибочные слова</h2><div className="mt-3 flex flex-wrap gap-2">{errorWords.length ? errorWords.map(word => <span key={word.word} className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">{word.word} · ошибок: {word.mistakes}</span>) : <span className="text-sm text-gray-500">Ошибочных слов пока нет.</span>}</div></section><section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="font-black">Слова в тренировках</h2><div className="mt-3 flex flex-wrap gap-2">{encounteredWords.length ? encounteredWords.map(word => <span key={word.word} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{word.word} · {wordAttempts(word)}×</span>) : <span className="text-sm text-gray-500">Пока нет слов. Они появятся после завершённых тренировок.</span>}</div></section><section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="font-black">Прогресс по словам</h2>{wordStats.length ? wordStats.map(word => <div key={word.word} className="mt-2 flex justify-between border-t border-indigo-50 pt-2 text-sm font-bold"><span>{word.word}</span><span>{accuracy(word)}%</span></div>) : <p className="mt-3 text-sm text-gray-500">Появится после тренировок.</p>}</section></main> : <main className="rounded-3xl bg-white p-8 text-center shadow-sm"><h2 className="text-2xl font-black text-indigo-950">{isTeacher ? 'Добавьте первого ученика' : 'Данные ребёнка пока не найдены'}</h2><p className="mt-2 text-sm font-bold text-gray-500">{isTeacher ? 'Введите код ребёнка, который родитель сформировал в своём кабинете.' : 'После первых тренировок здесь появится прогресс.'}</p></main>}</div></ScreenContainer>;
};
