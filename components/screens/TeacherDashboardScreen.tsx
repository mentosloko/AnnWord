import React, { useState } from 'react';
import { mentorRoomService } from '../../services/mentorRoomService';
import { UserProfile } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

type Props = { userProfile: UserProfile; onOpenDictionaryStudio: () => void; onOpenAdultRoom: () => void; onOpenProfile?: () => void; };
const t = { title: 'Кабинет преподавателя', subtitle: 'Рабочий режим без игр, питомцев и монет. Главный сценарий — подключить ученика, видеть прогресс и назначать словари.', students: 'Мои ученики', dictionaries: 'Мои словари', profile: 'Профиль', code: 'Список учеников, прогресс и сложные слова.', vocab: 'Создавайте словари и назначайте их подключённым ученикам.', progress: 'Настройки и сводка преподавателя.', connect: 'Подключить ученика', connectHelp: 'Родитель формирует код в кабинете родителя. Введите его здесь — ученик появится в разделе «Мои ученики».', placeholder: 'Код ребёнка', openStudents: 'Открыть учеников' };
const Card = ({ title, text, action, onClick }: { title: string; text: string; action: string; onClick: () => void }) => <button type="button" onClick={onClick} className="rounded-[1.75rem] border-2 border-cyan-50 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-lg"><div className="text-xl font-black text-indigo-950">{title}</div><p className="mt-2 min-h-[3.25rem] text-sm font-bold leading-relaxed text-gray-500">{text}</p><div className="mt-5 inline-flex rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-black text-white">{action}</div></button>;
export const TeacherDashboardScreen: React.FC<Props> = ({ userProfile, onOpenDictionaryStudio, onOpenAdultRoom, onOpenProfile }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const normalizedCode = code.trim().toUpperCase();
  const connect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!normalizedCode) { setNotice('Введите код ребёнка.'); return; }
    setBusy(true);
    setNotice(null);
    try {
      await mentorRoomService.connectByChildCode(normalizedCode);
      setCode('');
      setNotice('Ученик подключён. Открываю раздел учеников.');
      window.setTimeout(onOpenAdultRoom, 450);
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'Не удалось подключить ученика.');
    } finally {
      setBusy(false);
    }
  };
  return <ScreenContainer className="max-w-6xl pb-20 pt-6"><section className="rounded-[2rem] bg-gradient-to-br from-cyan-700 to-indigo-700 p-6 text-white shadow-xl sm:p-8"><div className="grid gap-6 lg:grid-cols-[1fr_28rem] lg:items-center"><div><div className="text-xs font-black uppercase tracking-widest text-white/65">AnnWord Teacher</div><h1 className="mt-2 text-4xl font-black sm:text-5xl">{t.title}</h1><p className="mt-4 max-w-2xl text-sm font-bold leading-relaxed text-white/75 sm:text-base">{t.subtitle}</p><div className="mt-5 text-sm font-black text-white/80">{userProfile.username}</div></div><form onSubmit={event => void connect(event)} className="rounded-[1.75rem] border border-white/15 bg-white/12 p-4 backdrop-blur"><div className="text-xs font-black uppercase tracking-widest text-white/65">Первый шаг</div><h2 className="mt-1 text-2xl font-black text-white">{t.connect}</h2><p className="mt-2 text-xs font-bold leading-relaxed text-white/70">{t.connectHelp}</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={code} onChange={event => { setCode(event.target.value.toUpperCase()); setNotice(null); }} placeholder={t.placeholder} className="min-w-0 flex-1 rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-black uppercase tracking-widest text-indigo-950 outline-none" /><button type="submit" disabled={busy || !normalizedCode} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-60">{busy ? '...' : t.connect}</button></div>{notice && <div role="status" aria-live="polite" className="mt-3 rounded-2xl bg-white/15 px-3 py-2 text-xs font-bold text-white">{notice}</div>}</form></div></section><section className="mt-6 grid gap-4 md:grid-cols-3"><Card title={t.students} text={t.code} action={t.openStudents} onClick={onOpenAdultRoom} /><Card title={t.dictionaries} text={t.vocab} action={t.dictionaries} onClick={onOpenDictionaryStudio} /><Card title={t.profile} text={t.progress} action={t.profile} onClick={onOpenProfile || onOpenAdultRoom} /></section></ScreenContainer>;
};
