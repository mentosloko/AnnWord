import React, { useEffect, useMemo, useState } from 'react';
import { familyAccountService, type TeacherConnection } from '../../services/familyAccountService';
import { parentPinResetService } from '../../services/parentPinResetService';
import { mentorRoomService } from '../../services/mentorRoomService';
import { formatPremiumAccessPeriod, isPremiumActive } from '../../services/premiumAccess';
import { getRecentFixedWords, getWordLearningSummary } from '../../services/wordLearningStats';
import { ManagedLearner, UserProfile, WordPerformance } from '../../types';
import { ReviewWordList } from '../ReviewWordList';
import { WeeklyReportSettingsCard } from '../WeeklyReportSettingsCard';
import { ScreenContainer } from '../layout/ScreenContainer';
import { StableStatusSlot } from '../ui/StatusNotice';
import { ExperienceState, MetricCard, SectionCard, SegmentedTabs, experienceUi } from '../ui/ExperiencePrimitives';

type Props = { userProfile: UserProfile; onBackHome: () => void; onOpenDictionaryStudio: () => void };
type Tab = 'overview' | 'words' | 'settings';
const supportEmail = 'support@annword.ru';
const attempts = (word: WordPerformance) => Math.max(0, Math.round(word.attempts || 0));
const accuracy = (word: WordPerformance) => attempts(word) ? Math.round(word.correct / attempts(word) * 100) : 0;

export const ParentDashboardScreen: React.FC<Props> = ({ userProfile, onBackHome, onOpenDictionaryStudio }) => {
  const premium = isPremiumActive(userProfile);
  const premiumPeriod = formatPremiumAccessPeriod(userProfile.premiumExpiresAt);
  const trialPremium = premium && Boolean(userProfile.kidsTrialStartedAt && userProfile.kidsTrialExpiresAt);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'unlock' | 'reset' | 'load' | null>(null);
  const [teacherBusy, setTeacherBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [learners, setLearners] = useState<ManagedLearner[]>([]);
  const [teacherConnections, setTeacherConnections] = useState<TeacherConnection[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const learner = learners.find(item => item.id === selectedId) || learners[0];
  const dataRequestHref = (kind: 'export' | 'delete') => {
    const action = kind === 'export' ? 'экспорт данных' : 'удаление аккаунта и данных';
    const learnerName = learner?.name || 'ребёнка';
    return 'mailto:' + supportEmail
      + '?subject=' + encodeURIComponent('AnnWord — ' + action + ': ' + learnerName)
      + '&body=' + encodeURIComponent('Прошу ' + action + ' для профиля ребёнка «' + learnerName + '». Я подтверждаю, что являюсь родителем/законным представителем.');
  };
  const encountered = useMemo<WordPerformance[]>(() => {
    const performance = (learner?.stats.wordPerformance || {}) as Record<string, WordPerformance>;
    return Object.values(performance).filter(item => attempts(item) > 0).sort((a, b) => attempts(b) - attempts(a));
  }, [learner]);
  const learning = useMemo(() => getWordLearningSummary(learner?.stats || { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} }), [learner]);
  const fixed = useMemo(() => getRecentFixedWords(learner?.stats || { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} }, 12), [learner]);
  const learnedCount = encountered.filter(word => word.correct > 0 && accuracy(word) >= 80).length;

  const applyLearners = (items: ManagedLearner[]) => {
    setLearners(items);
    setSelectedId(current => items.some(item => item.id === current) ? current : items[0]?.id || '');
    setLoadError(null);
  };
  const load = async (force = false) => {
    setBusy('load'); setLoadError(null);
    try { applyLearners((await mentorRoomService.loadLearners(force)).learners); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить данные ребёнка.'); }
    finally { setBusy(null); }
  };
  const loadTeacherConnections = async () => {
    try { setTeacherConnections(await familyAccountService.loadTeacherConnections()); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось загрузить подключения преподавателей.'); }
  };
  useEffect(() => { if (unlocked && !learners.length && !loadError && busy !== 'load') void load(); }, [unlocked]);
  useEffect(() => { if (unlocked) void loadTeacherConnections(); }, [unlocked]);

  const unlock = async () => {
    setPinError(null); setNotice(null);
    if (!/^\d{4}$/.test(pin)) { setPinError('Введите PIN из четырёх цифр.'); return; }
    setBusy('unlock');
    try { const result = await familyAccountService.openAdultRoom(pin); applyLearners(result.learners); setUnlocked(true); setPin(''); }
    catch (error) { setPin(''); setPinError(error instanceof Error ? error.message : 'Не удалось открыть кабинет родителя.'); }
    finally { setBusy(null); }
  };
  const resetPin = async () => {
    setPinError(null); setNotice(null); setBusy('reset');
    try { setNotice(await parentPinResetService.request()); }
    catch (error) { setPinError(error instanceof Error ? error.message : 'Не удалось отправить письмо для восстановления PIN.'); }
    finally { setBusy(null); }
  };
  const copyCode = async () => {
    if (!learner?.childShareCode) return;
    try { await navigator.clipboard.writeText(learner.childShareCode); setNotice('Одноразовый код скопирован. После подключения преподавателя он перестанет действовать.'); }
    catch { setNotice('Не удалось скопировать код. Выделите его вручную.'); }
  };
  const createTeacherCode = async () => {
    if (!premium) { setNotice('Код преподавателя доступен в Kids Premium.'); return; }
    setTeacherBusy('invite'); setNotice(null);
    try {
      const code = await familyAccountService.createTeacherInvite();
      setLearners(current => current.map(item => item.id === learner?.id ? { ...item, childShareCode: code } : item));
      setNotice('Новый одноразовый код создан. Он действует 24 часа и только до первого подключения.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось создать код преподавателя.'); }
    finally { setTeacherBusy(null); }
  };
  const revokeTeacher = async (connection: TeacherConnection) => {
    setTeacherBusy(connection.teacherId); setNotice(null);
    try {
      await familyAccountService.revokeTeacherConnection(connection.teacherId);
      setTeacherConnections(current => current.filter(item => item.teacherId !== connection.teacherId));
      setNotice(`Доступ преподавателя «${connection.name}» отозван.`);
      await load(true);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось отозвать доступ преподавателя.'); }
    finally { setTeacherBusy(null); }
  };

  if (!unlocked) return <ScreenContainer className="max-w-md pb-24 pt-5"><button type="button" onClick={onBackHome} className={experienceUi.secondaryButton}>← Назад</button><SectionCard className="mt-4"><form onSubmit={event => { event.preventDefault(); void unlock(); }}><div className={experienceUi.eyebrow}>Для взрослого</div><h1 className="mt-1 text-3xl font-bold text-indigo-950">Кабинет родителя</h1><p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">Введите PIN, созданный при добавлении ребёнка. Он защищает отчёты и настройки от случайного входа.</p><div className="mt-3"><StableStatusSlot message={pinError || notice} tone={pinError ? 'error' : 'info'} role={pinError ? 'alert' : 'status'} /></div><input value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(null); }} type="password" inputMode="numeric" autoComplete="off" aria-label="PIN родителя" maxLength={4} placeholder="••••" className="mt-3 w-full rounded-2xl border-2 border-indigo-100 p-4 text-center text-2xl font-bold tracking-[0.5em] focus:border-indigo-500 focus:outline-none" /><button type="submit" disabled={Boolean(busy)} className={`mt-4 w-full ${experienceUi.primaryButton}`}>{busy === 'unlock' ? 'Открываю…' : 'Открыть кабинет'}</button><button type="button" disabled={Boolean(busy)} onClick={() => void resetPin()} className={`mt-2 w-full ${experienceUi.secondaryButton}`}>{busy === 'reset' ? 'Отправляю письмо…' : 'Забыли PIN? Восстановить по email'}</button></form></SectionCard></ScreenContainer>;

  const tabs = [
    { id: 'overview' as const, label: 'Обзор' },
    { id: 'words' as const, label: 'Слова', badge: learning.activeReview.length },
    { id: 'settings' as const, label: 'Настройки' },
  ];

  return <ScreenContainer className="max-w-6xl pb-24 pt-4 sm:pb-20 sm:pt-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={onBackHome} className={experienceUi.secondaryButton}>← На главную</button><div className="min-w-0 text-center"><div className={experienceUi.eyebrow}>AnnWord Kids</div><h1 className="text-2xl font-bold text-indigo-950 sm:text-3xl">Кабинет родителя</h1></div><button type="button" onClick={onOpenDictionaryStudio} className={experienceUi.primaryButton}>Слова ребёнка</button></header>
    {notice && <div className="mt-4"><ExperienceState compact kind="success" title={notice} /></div>}
    {loadError && <div className="mt-4"><ExperienceState kind="error" title="Данные не загрузились" description={loadError} actionLabel="Повторить" onAction={() => void load(true)} /></div>}
    {learners.length > 1 && <SectionCard className="mt-5"><div className={experienceUi.eyebrow}>Ребёнок</div><div className="mt-3 flex flex-wrap gap-2">{learners.map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`rounded-xl px-4 py-2 text-sm font-bold ${learner?.id === item.id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'}`}>{item.name}</button>)}</div></SectionCard>}
    <div className="mt-5"><SegmentedTabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Разделы кабинета родителя" /></div>

    {!learner && busy === 'load' && <div className="mt-5"><ExperienceState kind="loading" title="Загружаю профиль ребёнка" /></div>}
    {!learner && busy !== 'load' && !loadError && <div className="mt-5"><ExperienceState title="Профиль ребёнка не найден" description="Вернитесь на главную и завершите создание детского профиля." /></div>}

    {learner && tab === 'overview' && <div className="mt-5 space-y-5"><SectionCard><div className="flex flex-wrap items-start justify-between gap-3"><div><div className={experienceUi.eyebrow}>Сегодня</div><h2 className="mt-1 text-3xl font-bold text-indigo-950">{learner.name}</h2><p className="mt-2 text-sm font-medium text-slate-500">Краткий обзор без технических показателей.</p></div><span className={`rounded-full px-3 py-1.5 text-sm font-bold ${premium ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{premium ? `${trialPremium ? 'Пробный Premium' : 'Premium'} ${premiumPeriod}` : 'Бесплатный Kids'}</span></div><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"><MetricCard value={learner.stats.gamesPlayed} label="тренировок" /><MetricCard value={learner.stats.gamesWon} label="успешных" /><MetricCard value={learnedCount} label="выучено" /><MetricCard value={learning.activeReview.length} label="повторить" /></div></SectionCard><SectionCard><div className={experienceUi.eyebrow}>Следующий шаг</div><h2 className="mt-1 text-xl font-bold text-indigo-950">{learning.activeReview.length ? `Закрепить ${learning.activeReview.length} ${learning.activeReview.length === 1 ? 'слово' : 'слов'}` : 'Продолжить регулярные игры'}</h2><p className="mt-2 text-sm font-medium text-slate-500">{learning.activeReview.length ? 'Сложные слова уже автоматически чаще появляются в тренировках.' : 'Активных ошибок нет — достаточно поддерживать серию короткими играми.'}</p><button type="button" onClick={() => setTab('words')} className={`mt-4 ${experienceUi.secondaryButton}`}>Посмотреть слова</button></SectionCard></div>}

    {learner && tab === 'words' && <div className="mt-5 grid gap-5 lg:grid-cols-2"><SectionCard><div className="text-xs font-bold uppercase tracking-wider text-rose-500">Нужно закрепить</div><h2 className="mt-1 text-xl font-bold text-indigo-950">Слова для повторения</h2><p className="mt-2 text-sm font-medium text-slate-500">Нажмите на слово, чтобы увидеть перевод.</p>{learning.activeReview.length ? <ReviewWordList words={learning.activeReview.map(item => item.word)} className="mt-4" /> : <div className="mt-4"><ExperienceState compact kind="success" title="Активных ошибок нет" /></div>}</SectionCard><SectionCard><div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Уже получается</div><h2 className="mt-1 text-xl font-bold text-indigo-950">Недавно исправлено</h2><div className="mt-4 flex flex-wrap gap-2">{fixed.length ? fixed.map(item => <span key={item.word} className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">{item.word}</span>) : <ExperienceState compact title="Пока нет исправленных слов" />}</div></SectionCard><SectionCard className="lg:col-span-2"><div className={experienceUi.eyebrow}>Чаще всего встречались</div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{encountered.length ? encountered.slice(0, 12).map(word => <div key={word.word} className="rounded-2xl bg-indigo-50/70 p-3"><div className="font-bold text-indigo-950">{word.word}</div><div className="mt-1 text-xs font-medium text-indigo-500">{attempts(word)} попыток · точность {accuracy(word)}%</div></div>) : <ExperienceState compact title="Статистика появится после игр" />}</div></SectionCard></div>}

    {learner && tab === 'settings' && <div className="mt-5 grid gap-5 lg:grid-cols-2"><SectionCard><div className={experienceUi.eyebrow}>Слова и задания</div><h2 className="mt-1 text-xl font-bold text-indigo-950">Управление словарями</h2><p className="mt-2 text-sm font-medium text-slate-500">Добавьте школьные слова или выберите тематическую подборку.</p><button type="button" onClick={onOpenDictionaryStudio} className={`mt-4 w-full ${experienceUi.primaryButton}`}>Открыть словари</button></SectionCard><SectionCard><div className={experienceUi.eyebrow}>Данные ребёнка</div><h2 className="mt-1 text-xl font-bold text-indigo-950">Экспорт или удаление</h2><p className="mt-2 text-sm font-medium text-slate-500">Эти действия доступны только после входа в кабинет родителя с PIN. Поддержка подтвердит запрос по email.</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><a href={dataRequestHref('export')} className={experienceUi.secondaryButton}>Запросить экспорт</a><a href={dataRequestHref('delete')} className="rounded-2xl border-2 border-rose-100 bg-rose-50 px-4 py-3 text-center font-bold text-rose-700 transition hover:bg-rose-100">Запросить удаление</a></div></SectionCard><SectionCard><div className={experienceUi.eyebrow}>Преподаватель</div>{premium ? <>{learner.childShareCode ? <><div className="mt-3 rounded-2xl bg-purple-50 p-4 text-center text-2xl font-bold tracking-widest text-purple-800">{learner.childShareCode}</div><p className="mt-2 text-sm font-medium text-slate-500">Одноразовый код действует 24 часа и перестаёт работать после первого подключения.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => void copyCode()} className={experienceUi.secondaryButton}>Скопировать код</button><button type="button" disabled={teacherBusy === 'invite'} onClick={() => void createTeacherCode()} className={experienceUi.secondaryButton}>{teacherBusy === 'invite' ? 'Создаю…' : 'Создать новый код'}</button></div></> : <><ExperienceState compact title="Активного кода нет" description="Создайте одноразовый код, когда хотите подключить преподавателя." /><button type="button" disabled={teacherBusy === 'invite'} onClick={() => void createTeacherCode()} className={`mt-3 w-full ${experienceUi.primaryButton}`}>{teacherBusy === 'invite' ? 'Создаю…' : 'Создать одноразовый код'}</button></>}</> : <ExperienceState title="Код доступен в Kids Premium" description="Подключённых ранее преподавателей можно отозвать ниже независимо от подписки." />}{teacherConnections.length ? <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-sm font-bold text-indigo-950">Подключённые преподаватели</h3><div className="mt-3 space-y-2">{teacherConnections.map(connection => <div key={connection.teacherId} className="rounded-2xl bg-slate-50 p-3"><div className="font-bold text-slate-900">{connection.name}</div><div className="mt-1 break-all text-xs font-medium text-slate-500">{connection.email}</div><div className="mt-1 text-xs text-slate-400">Подключён {new Date(connection.connectedAt).toLocaleDateString('ru-RU')}</div><button type="button" disabled={teacherBusy === connection.teacherId} onClick={() => void revokeTeacher(connection)} className="mt-3 rounded-xl border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-50">{teacherBusy === connection.teacherId ? 'Отзываю…' : 'Отозвать доступ'}</button></div>)}</div></div> : <p className="mt-4 text-sm font-medium text-slate-500">Подключённых преподавателей пока нет.</p>}</SectionCard><div className="lg:col-span-2"><WeeklyReportSettingsCard userProfile={userProfile} premiumActive={premium} /></div></div>}
  </ScreenContainer>;
};