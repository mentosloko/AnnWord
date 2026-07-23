import React, { useEffect, useMemo, useRef, useState } from 'react';
import { familyAccountService } from '../../services/familyAccountService';
import { parentPinResetService } from '../../services/parentPinResetService';
import { mentorRoomService, type MentorRoomLoadResult } from '../../services/mentorRoomService';
import { isPremiumActive, formatPremiumAccessPeriod } from '../../services/premiumAccess';
import { getRecentFixedWords, getWordLearningSummary } from '../../services/wordLearningStats';
import { loadingNow, loadingTelemetry } from '../../services/loadingTelemetry';
import { ManagedLearner, UserProfile, WordPerformance } from '../../types';
import { useProfileFreshness } from '../../hooks/useProfileFreshness';
import { WeeklyReportSettingsCard } from '../WeeklyReportSettingsCard';
import { ScreenContainer } from '../layout/ScreenContainer';
import { FloatingNotice, StableStatusSlot } from '../ui/StatusNotice';

interface Props { userProfile: UserProfile; onBackHome: () => void; onOpenDictionaryStudio: () => void; }
type LearnersStatus = 'idle' | 'loading' | 'success' | 'error';
type BusyAction = 'unlock' | 'pin-reset' | 'connect' | 'assign' | null;
const attempts = (word: WordPerformance) => Math.max(0, Math.round(word.attempts || 0));
const accuracy = (word: WordPerformance) => attempts(word) ? Math.round(word.correct / attempts(word) * 100) : 0;
const learned = (word: WordPerformance) => word.correct > 0 && accuracy(word) >= 80;
const byMistakes = (a: WordPerformance, b: WordPerformance) => b.mistakes - a.mistakes || attempts(b) - attempts(a) || a.word.localeCompare(b.word);
const byFrequency = (a: WordPerformance, b: WordPerformance) => attempts(b) - attempts(a) || b.mistakes - a.mistakes || a.word.localeCompare(b.word);
const getEncounteredWords = (learner?: ManagedLearner): WordPerformance[] => Object.values(learner?.stats.wordPerformance ?? {}).filter(word => attempts(word) > 0).sort(byFrequency);
const Metric = ({ label, value }: { label: string; value: number | string }) => <div className="min-w-0 rounded-2xl bg-white p-3 shadow-sm sm:p-4"><div className="break-words text-[11px] font-black leading-tight text-indigo-400 sm:text-xs">{label}</div><div className="mt-1 text-2xl font-black text-indigo-950 sm:text-3xl">{value}</div></div>;
const EmptyCard = ({ children }: { children: React.ReactNode }) => <div className="rounded-2xl bg-indigo-50 p-3 text-sm font-bold text-indigo-700">{children}</div>;
const LoadingCard = ({ children = 'Загружаю данные…' }: { children?: React.ReactNode }) => <div role="status" aria-live="polite" className="animate-pulse rounded-2xl bg-indigo-50 p-3 text-sm font-bold text-indigo-500">{children}</div>;

export const AdultRoomScreen: React.FC<Props> = ({ userProfile, onBackHome, onOpenDictionaryStudio }) => {
  const isTeacher = userProfile.role === 'teacher' || userProfile.accountMode === 'teacher';
  const isParent = userProfile.role === 'parent' || userProfile.accountMode === 'parent';
  const premiumActive = isPremiumActive(userProfile);
  const profileFreshness = useProfileFreshness();
  const premiumChecking = !premiumActive && profileFreshness !== 'fresh';
  const loadStartedAtRef = useRef(loadingNow());
  const [unlocked, setUnlocked] = useState(!isParent || isTeacher);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [learners, setLearners] = useState<ManagedLearner[]>([]);
  const [learnersStatus, setLearnersStatus] = useState<LearnersStatus>('idle');
  const [learnersError, setLearnersError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const learner = learners.find(item => item.id === selectedId) || learners[0];
  const collections = userProfile.dictionaryCollections || [];
  const encounteredWords = useMemo(() => getEncounteredWords(learner), [learner]);
  const learnedWords = encounteredWords.filter(learned);
  const errorWords = useMemo(() => encounteredWords.filter(word => word.mistakes > 0).sort(byMistakes), [encounteredWords]);
  const learning = useMemo(() => getWordLearningSummary(learner?.stats || { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} }), [learner]);
  const recentFixed = useMemo(() => getRecentFixedWords(learner?.stats || { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} }, 10), [learner]);
  const normalizedCode = code.trim().toUpperCase();
  const transientMessage = learnersError || notice;

  useEffect(() => {
    if (profileFreshness === 'cached') loadingTelemetry.recordScreen({ screen: 'adult_room', state: 'stale', detail: 'cached_profile' });
  }, [profileFreshness]);

  const beginLoadTelemetry = (detail: string) => {
    loadStartedAtRef.current = loadingNow();
    loadingTelemetry.recordScreen({ screen: 'adult_room', state: 'loading', detail });
  };

  const finishLoadTelemetry = (state: 'ready' | 'empty' | 'error', detail?: string) => {
    loadingTelemetry.recordScreen({
      screen: 'adult_room',
      state,
      durationMs: Math.round(loadingNow() - loadStartedAtRef.current),
      detail,
    });
  };

  const applyLearnersResult = (result: MentorRoomLoadResult) => {
    setLearners(result.learners);
    setSelectedId(current => result.learners.some(item => item.id === current) ? current : result.learners[0]?.id || '');
    setLearnersStatus('success');
    setLearnersError(null);
    finishLoadTelemetry(result.learners.length ? 'ready' : 'empty', result.backendReady ? undefined : 'backend_not_ready');
    if (!result.backendReady) setNotice('Данные кабинета пока недоступны.');
  };

  const load = async (force = false) => {
    beginLoadTelemetry(force ? 'refresh' : 'initial');
    setLearnersStatus('loading');
    setLearnersError(null);
    try {
      applyLearnersResult(await mentorRoomService.loadLearners(force));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить данные.';
      setLearnersError(message);
      setLearnersStatus('error');
      finishLoadTelemetry('error', message);
    }
  };

  useEffect(() => {
    if ((unlocked || isTeacher) && learnersStatus === 'idle') void load();
  }, [unlocked, isTeacher, learnersStatus]);

  const unlock = async () => {
    setNotice(null);
    setLearnersError(null);
    if (!/^\d{4}$/.test(pin)) { setPinError('Введите PIN из 4 цифр.'); return; }
    beginLoadTelemetry('pin_unlock');
    setBusyAction('unlock');
    setLearnersStatus('loading');
    try {
      const result = await familyAccountService.openAdultRoom(pin);
      applyLearnersResult(result);
      setUnlocked(true);
      setPinError(null);
      setPin('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Не удалось открыть кабинет родителя.';
      setLearnersStatus('idle');
      setPin('');
      setPinError(message);
      finishLoadTelemetry('error', message);
    } finally {
      setBusyAction(null);
    }
  };

  const requestPinReset = async () => {
    setPinError(null);
    setNotice(null);
    setBusyAction('pin-reset');
    try {
      setNotice(await parentPinResetService.request());
    } catch (error: unknown) {
      setPinError(error instanceof Error ? error.message : 'Не удалось отправить письмо для восстановления PIN.');
    } finally {
      setBusyAction(null);
    }
  };

  const connect = async () => {
    setNotice(null);
    setCodeError(null);
    if (!normalizedCode) { setCodeError('Введите код ребёнка.'); return; }
    setBusyAction('connect');
    try {
      await mentorRoomService.connectByChildCode(normalizedCode);
      setCode('');
      setNotice('Ученик подключён.');
      await load(true);
    } catch (error: unknown) {
      setCodeError(error instanceof Error ? error.message : 'Не удалось подключить ученика.');
    } finally {
      setBusyAction(null);
    }
  };

  const assign = async () => {
    if (!learner || !collectionId) return;
    setBusyAction('assign');
    try {
      await mentorRoomService.assignCollection(learner.id, collectionId);
      setNotice('Словарь назначен ученику.');
      await load(true);
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'Не удалось назначить словарь.');
    } finally {
      setBusyAction(null);
    }
  };

  const copyChildCode = async (childCode: string) => {
    if (premiumChecking) { setNotice('Проверяем доступ Premium. Повторите действие через несколько секунд.'); return; }
    if (!premiumActive) { setNotice('Код преподавателя доступен в Kids Premium.'); return; }
    try {
      await navigator.clipboard.writeText(childCode);
      setNotice('Код скопирован. Передайте его преподавателю.');
    } catch {
      setNotice('Не удалось скопировать код. Скопируйте его вручную.');
    }
  };

  if (isParent && !isTeacher && !unlocked) return <ScreenContainer className="max-w-md pb-20">
    <button type="button" onClick={onBackHome} className="mb-5 rounded-xl border-2 border-indigo-100 px-4 py-2 font-bold text-indigo-700">← Назад</button>
    <section className="rounded-[2rem] bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-black text-indigo-950">Кабинет родителя</h1>
      <p id="parent-pin-help" className="mt-2 text-sm font-bold text-gray-500">Введите PIN, созданный при добавлении ребёнка на этом устройстве.</p>
      <div className="mt-4 rounded-2xl bg-indigo-50 p-3 text-xs font-bold text-indigo-700">PIN защищает кабинет взрослого от случайного входа ребёнка.</div>
      <div className="mt-4"><StableStatusSlot message={pinError} tone="error" role="alert" /></div>
      <input value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g, '').slice(0, 4)); if (pinError) setPinError(null); }} type="password" inputMode="numeric" autoComplete="off" name="parentPin" aria-label="PIN родителя" aria-invalid={Boolean(pinError)} aria-describedby={pinError ? 'parent-pin-error parent-pin-help' : 'parent-pin-help'} maxLength={4} placeholder="••••" className={`mt-5 w-full rounded-xl border-2 p-3 text-center text-xl font-black ${pinError ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-indigo-100'}`} />
      <p className="mt-2 text-center text-xs font-bold text-gray-400">4 цифры. Только для этого устройства.</p>
      <button type="button" disabled={busyAction === 'unlock' || busyAction === 'pin-reset'} onClick={() => void unlock()} className="mt-4 w-full rounded-xl bg-indigo-600 p-3 font-black text-white disabled:bg-gray-200 disabled:text-gray-400">{busyAction === 'unlock' ? 'Открываю кабинет...' : 'Открыть'}</button>
      <button type="button" disabled={busyAction === 'unlock' || busyAction === 'pin-reset'} onClick={() => void requestPinReset()} className="mt-3 w-full rounded-xl border-2 border-purple-100 bg-purple-50 p-3 font-black text-purple-700 disabled:opacity-60">{busyAction === 'pin-reset' ? 'Отправляю письмо…' : 'Забыли PIN? Восстановить по email'}</button>
    </section>
  </ScreenContainer>;

  return <ScreenContainer className="max-w-6xl pb-20">
    <header className="mb-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      <button type="button" onClick={onBackHome} aria-label="Назад" className="w-full rounded-xl border-2 border-indigo-100 px-4 py-2 font-bold text-indigo-700 sm:w-auto">←</button>
      <div className="min-w-0 text-center"><div className="truncate text-xs font-black uppercase tracking-widest text-indigo-400">{isTeacher ? 'AnnWord Teacher · Ученики' : 'AnnWord Kids'}</div><h1 className="break-words text-xl font-black text-indigo-950 sm:text-3xl">{isTeacher ? 'Ученики преподавателя' : 'Кабинет родителя'}</h1></div>
      {isTeacher || premiumActive ? <button type="button" onClick={onOpenDictionaryStudio} className="w-full rounded-xl bg-indigo-600 px-4 py-2 font-black text-white sm:w-auto">Открыть словари</button> : premiumChecking ? <button type="button" disabled className="w-full rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-400 sm:w-auto">Проверяем доступ…</button> : <button type="button" onClick={onOpenDictionaryStudio} className="w-full rounded-xl bg-purple-50 px-3 py-2 text-xs font-black text-purple-700 sm:w-auto">Словари · Premium</button>}
    </header>

    {!isTeacher && (premiumChecking ? <section className="mb-5 rounded-3xl border-2 border-indigo-100 bg-indigo-50 p-4"><div className="text-xs font-black uppercase tracking-widest text-indigo-500">Проверяем доступ</div><p className="mt-1 text-sm font-bold text-gray-600">Обновляем данные подписки с сервера…</p></section> : <section className={`mb-5 rounded-3xl border-2 p-4 ${premiumActive ? 'border-green-100 bg-green-50' : 'border-amber-100 bg-amber-50'}`}><div className={`text-xs font-black uppercase tracking-widest ${premiumActive ? 'text-green-600' : 'text-amber-600'}`}>{premiumActive ? 'Kids Premium активен' : 'Бесплатный Kids'}</div><p className="mt-1 text-sm font-bold text-gray-600">{premiumActive ? `Доступ открыт ${formatPremiumAccessPeriod(userProfile.premiumExpiresAt)}.` : 'Игры, питомец, магазин и общий детский словарь доступны бесплатно. Код преподавателя, отчёты и расширенные словари открываются в Premium.'}</p></section>)}
    <FloatingNotice message={transientMessage} tone={learnersError ? 'error' : 'info'} role={learnersError ? 'alert' : 'status'} actionLabel={learnersError ? 'Повторить' : undefined} onAction={learnersError ? () => void load(true) : undefined} />

    {isTeacher && <section className="mb-5 min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-5"><h2 className="font-black text-indigo-950">Подключить ученика по коду</h2><p className="mt-1 text-sm font-bold text-gray-500">Введите код, который родитель передал из своего кабинета.</p><div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row"><input value={code} onChange={event => { setCode(event.target.value.toUpperCase()); if (codeError) setCodeError(null); }} placeholder="Код ребёнка" aria-label="Код ребёнка" aria-invalid={Boolean(codeError)} aria-describedby={codeError ? 'teacher-code-error' : undefined} name="childCode" className={`min-w-0 flex-1 rounded-xl border-2 px-3 py-2 font-black uppercase ${codeError ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-indigo-100'}`} /><button type="button" disabled={busyAction === 'connect' || !normalizedCode} onClick={() => void connect()} className="rounded-xl bg-indigo-600 px-4 py-3 font-black text-white disabled:bg-gray-200 disabled:text-gray-400">{busyAction === 'connect' ? 'Подключаю…' : 'Подключить'}</button></div><div id="teacher-code-error" className="mt-3"><StableStatusSlot message={codeError} tone="error" role="alert" /></div></section>}

    <div className="grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-black uppercase text-indigo-400">{isTeacher ? 'Ученики' : 'Ребёнок'}</h2>
        {learnersStatus === 'loading' && !learners.length ? <LoadingCard /> : learners.length ? <>{learners.map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} aria-pressed={selectedId === item.id} className={`mb-2 w-full min-w-0 break-words rounded-xl p-3 text-left font-black ${selectedId === item.id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-950'}`}>{item.name}</button>)}{learnersStatus === 'loading' && <p className="mt-2 text-xs font-bold text-indigo-400">Обновляю данные…</p>}</> : learnersStatus === 'success' ? <EmptyCard>{isTeacher ? 'Пока нет подключённых учеников.' : 'Профиль ребёнка не найден.'}</EmptyCard> : learnersStatus === 'error' ? <EmptyCard>Данные не загружены. Нажмите «Повторить» выше.</EmptyCard> : <LoadingCard />}
        {!isTeacher && learner?.childShareCode && (premiumActive ? <div className="mt-4 rounded-xl bg-purple-50 p-3"><div className="text-xs font-black text-purple-500">КОД ДЛЯ ПРЕПОДАВАТЕЛЯ</div><div className="mt-2 text-center text-xl font-black tracking-widest text-purple-800">{learner.childShareCode}</div><p className="mt-2 text-xs font-bold text-purple-700">Передайте этот код учителю.</p><button type="button" onClick={() => void copyChildCode(learner.childShareCode || '')} className="mt-3 w-full rounded-xl bg-purple-600 px-3 py-2 text-sm font-black text-white">Скопировать код</button></div> : premiumChecking ? <LoadingCard>Проверяем доступ к коду преподавателя…</LoadingCard> : <div className="mt-4 rounded-xl bg-amber-50 p-3"><div className="text-xs font-black text-amber-600">Код преподавателя</div><p className="mt-2 text-sm font-bold text-amber-800">Доступен в Kids Premium.</p></div>)}
        {!isTeacher && <WeeklyReportSettingsCard userProfile={userProfile} premiumActive={premiumActive} />}
      </aside>

      {learner ? <main className="min-w-0 space-y-4">
        <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4"><Metric label="ИГР" value={learner.stats.gamesPlayed} /><Metric label="ПОБЕД" value={learner.stats.gamesWon} /><Metric label="СЛОВ ВСТРЕТИЛОСЬ" value={encounteredWords.length} /><Metric label="ОШИБОЧНЫХ" value={errorWords.length} /></div>
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3"><Metric label="ВЫУЧЕНО" value={learnedWords.length} /><Metric label="К ПОВТОРЕНИЮ" value={learning.activeReview.length} /><Metric label="ИСПРАВЛЕНО" value={learning.fixedAfterMistake.length} /></div>
        {isTeacher && <section className="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-5"><h2 className="font-black">Назначить сохранённый словарь</h2><p className="mt-1 text-sm font-bold text-gray-500">Словарь появится у ребёнка, если у семьи активен Premium.</p><div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row"><select value={collectionId} onChange={event => setCollectionId(event.target.value)} className="min-w-0 flex-1 rounded-xl border-2 border-indigo-100 p-2 font-bold"><option value="">Выберите подборку</option>{collections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button type="button" disabled={!collectionId || busyAction === 'assign'} onClick={() => void assign()} className="rounded-xl bg-indigo-600 px-4 py-3 font-black text-white disabled:bg-gray-200 disabled:text-gray-400">{busyAction === 'assign' ? 'Назначаю…' : 'Назначить'}</button></div>{!collections.length && <p className="mt-3 text-xs font-bold text-gray-500">Сначала создайте словарь в разделе «Словари».</p>}</section>}
        <section className="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-5"><h2 className="font-black">Ошибки и исправления</h2><p className="mt-1 text-sm font-bold text-gray-500">Сложные слова и исправления по истории тренировок.</p><div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2"><div className="min-w-0 rounded-2xl bg-rose-50 p-3"><div className="text-xs font-black uppercase text-rose-500">К повторению</div>{learning.activeReview.length ? learning.activeReview.slice(0, 8).map(item => <div key={item.word} className="mt-2 break-all font-black text-rose-900">{item.word}</div>) : <p className="mt-2 text-sm font-bold text-rose-700">Нет активных повторений.</p>}</div><div className="min-w-0 rounded-2xl bg-green-50 p-3"><div className="text-xs font-black uppercase text-green-600">Недавно исправлено</div>{recentFixed.length ? recentFixed.map(item => <div key={item.word} className="mt-2 break-all font-black text-green-900">{item.word}</div>) : <p className="mt-2 text-sm font-bold text-green-700">Пока нет исправленных слов.</p>}</div></div></section>
        <section className="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-5"><h2 className="font-black">Частые слова</h2>{encounteredWords.length ? <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">{encounteredWords.slice(0, 12).map(word => <div key={word.word} className="min-w-0 rounded-2xl bg-indigo-50 p-3"><div className="break-all font-black text-indigo-950">{word.word}</div><div className="break-words text-xs font-bold text-indigo-500">попыток: {attempts(word)} · точность: {accuracy(word)}% · ошибок: {word.mistakes}</div></div>)}</div> : <EmptyCard>После игр здесь появится статистика слов.</EmptyCard>}</section>
      </main> : learnersStatus === 'loading' || learnersStatus === 'idle' ? <main className="min-w-0 rounded-3xl bg-white p-6 shadow-sm"><LoadingCard>Загружаю профиль и статистику…</LoadingCard></main> : learnersStatus === 'error' ? <main className="min-w-0 rounded-3xl bg-white p-6 shadow-sm"><EmptyCard>Не удалось подтвердить наличие профиля. Повторите загрузку.</EmptyCard></main> : <main className="min-w-0 rounded-3xl bg-white p-6 shadow-sm"><EmptyCard>{isTeacher ? 'Подключите ученика по коду, чтобы видеть прогресс.' : 'Профиль ребёнка ещё не создан.'}</EmptyCard></main>}
    </div>
  </ScreenContainer>;
};
