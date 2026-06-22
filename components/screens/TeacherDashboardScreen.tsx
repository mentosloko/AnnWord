import React, { useState } from 'react';
import { mentorRoomService } from '../../services/mentorRoomService';
import { UserProfile } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

type Props = { userProfile: UserProfile; onOpenDictionaryStudio: () => void; onOpenAdultRoom: () => void; onOpenProfile?: () => void; };
const t = { title: 'Обзор преподавателя', subtitle: 'Рабочий режим без игр, питомцев и монет. Основные разделы: ученики, словари и профиль преподавателя.', students: 'Ученики', dictionaries: 'Словари', profile: 'Профиль', code: 'Подключение учеников, прогресс, сложные слова и назначение словарей.', vocab: 'Создавайте подборки слов и назначайте их подключённым ученикам.', progress: 'Настройки, сводка и данные аккаунта преподавателя.', connect: 'Подключить ученика', connectHelp: 'Родитель формирует код в кабинете родителя. Введите его здесь — ученик появится в разделе «Ученики».', placeholder: 'Код ребёнка', openStudents: 'Открыть учеников' };
const Card = ({ title, text, action, onClick }: { title: string; text: string; action: string; onClick: () => void }) => <button type="button" onClick={onClick} className="rounded-[1.75rem] border-2 border-cyan-50 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-lg"><div className="text-xl font-black text-indigo-950">{title}</div><p className="mt-2 min-h-[3.25rem] text-sm font-bold leading-relaxed text-gray-500">{text}</p><div className="mt-5 inline-flex rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-black text-white">{action}</div></button>;
export const TeacherDashboardScreen: React.FC<Props> = ({ userProfile, onOpenDictionaryStudio, onOpenAdultRoom, onOpenProfile }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const normalizedCode = code.trim().toUpperCase();
  const connect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setFieldError(null);
    if (!normalizedCode) { setFieldError('Введите код ребёнка.'); return; }
    setBusy(true);
    try {
      await mentorRoomService.connectByChildCode(normalizedCode);
      setCode('');
      setNotice('Ученик подключён. Открываю раздел учеников.');
      window.setTimeout(onOpenAdultRoom, 450);
    } catch (error: unknown) {
      setFieldError(error instanceof Error ? error.message : 'Не удалось подключить ученика.');
    } finally {
      setBusy(false);
    }
  };
  return <ScreenContainer className="max-w-6xl pb-20 pt-6"><section className="rounded-[2rem] bg-gradient-to-br from-cyan-700 to-indigo-700 p-6 text-white shadow-xl sm:p-8"><div className="grid gap-6 lg:grid-cols-[1fr_28rem] lg:items-center"><div><div className="text-xs font-black uppercase tracking-widest text-white/65">AnnWord Teacher · Обзор</div><h1 className="mt-2 text-4xl font-black sm:text-5xl">{t.title}</h1><p className="mt-4 max-w-2xl text-sm font-bold leading-relaxed text-white/75 sm:text-base">{t.subtitle}</p><div className="mt-5 text-sm font-black text-white/80">{userProfile.username}</div></div><form onSubmit={event => void connect(event)} className="rounded-[1.75rem] border border-white/15 bg-white/12 p-4 backdrop-blur"><div className="text-xs font-black uppercase tracking-widest text-white/65">Быстрое действие</div><h2 className="mt-1 text-2xl font-black text-white">{t.connect}</h2><p className="mt-2 text-xs font-bold leading-relaxed text-white/70">{t.connectHelp}</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={code} onChange={event => { setCode(event.target.value.toUpperCase()); if (fieldError) setFieldError(null); }} placeholder={t.placeholder} aria-label={t.placeholder} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? 'teacher-dashboard-code-error' : undefined} className={`min-w-0 flex-1 rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-widest text-indigo-950 outline-none ${fieldError ? 'border-rose-300 bg-rose-50' : 'border-white/20 bg-white'}`} /><button type="submit" disabled={busy || !normalizedCode} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-60">{busy ? '...' : t.connect}</button></div>{fieldError && <div id="teacher-dashboard-code-error" role="alert" className="mt-3 rounded-2xl bg-rose-100 px-3 py-2 text-xs font-bold text-rose-800">{fieldError}</div>}{notice && <div role="status" aria-live="polite" className="mt-3 rounded-2xl bg-white/15 px-3 py-2 text-xs font-bold text-white">{notice}</div>}</form></div></section><section className="mt-5 grid gap-2 rounded-3xl bg-cyan-50 p-3 text-xs font-black text-cyan-800 sm:grid-cols-4"><div className="rounded-2xl bg-white px-3 py-2">Обзор</div><div className="rounded-2xl bg-white px-3 py-2">Ученики</div><div className="rounded-2xl bg-white px-3 py-2">Словари</div><div className="rounded-2xl bg-white px-3 py-2">Профиль</div></section><section className="mt-6 grid gap-4 md:grid-cols-3"><Card title={t.students} text={t.code} action={t.openStudents} onClick={onOpenAdultRoom} /><Card title={t.dictionaries} text={t.vocab} action="Открыть словари" onClick={onOpenDictionaryStudio} /><Card title={t.profile} text={t.progress} action="Открыть профиль" onClick={onOpenProfile || onOpenAdultRoom} /></section></ScreenContainer>;
};