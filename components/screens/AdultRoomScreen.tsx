import React, { useMemo, useState } from 'react';
import { ManagedLearner, UserProfile, WordPerformance } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface AdultRoomScreenProps {
  userProfile: UserProfile;
  onBackHome: () => void;
  onOpenDictionaryStudio: () => void;
}

const demoWordStats: Record<string, WordPerformance> = {
  SCHOOL: { word: 'SCHOOL', attempts: 8, correct: 7, mistakes: 1 },
  FRIEND: { word: 'FRIEND', attempts: 6, correct: 4, mistakes: 2 },
  KITCHEN: { word: 'KITCHEN', attempts: 5, correct: 2, mistakes: 3 },
};

const createPreviewLearner = (profile: UserProfile): ManagedLearner => ({
  id: 'preview-child',
  name: profile.role === 'teacher' ? 'Ученица Аня' : 'Ребёнок',
  classLabel: profile.role === 'teacher' ? '3А' : undefined,
  stats: { ...profile.stats, wordPerformance: profile.stats.wordPerformance || demoWordStats },
  assignedWords: profile.customDictionaryEn.slice(0, 8),
  weeklyAccuracy: profile.stats.gamesPlayed ? Math.round(profile.stats.gamesWon / profile.stats.gamesPlayed * 100) : 72,
});

const formatAccuracy = (word: WordPerformance): number => word.attempts > 0 ? Math.round(word.correct / word.attempts * 100) : 0;

export const AdultRoomScreen: React.FC<AdultRoomScreenProps> = ({ userProfile, onBackHome, onOpenDictionaryStudio }) => {
  const initialLearners = userProfile.managedLearners?.length ? userProfile.managedLearners : [createPreviewLearner(userProfile)];
  const [learners, setLearners] = useState(initialLearners);
  const [selectedId, setSelectedId] = useState(initialLearners[0]?.id || '');
  const [assignmentText, setAssignmentText] = useState('');
  const [reportEmail, setReportEmail] = useState(userProfile.weeklyReportEmail || '');
  const [reportsEnabled, setReportsEnabled] = useState(Boolean(userProfile.weeklyReportEmail));
  const [notice, setNotice] = useState<string | null>(null);
  const learner = learners.find(item => item.id === selectedId) || learners[0];
  const wordStats = useMemo(() => Object.values(learner?.stats.wordPerformance || demoWordStats)
    .sort((left, right) => formatAccuracy(left) - formatAccuracy(right)), [learner]);

  const addWords = () => {
    if (!learner) return;
    const words = Array.from(new Set((assignmentText.match(/[A-Za-z][A-Za-z'-]{1,}/g) || []).map(word => word.toUpperCase())));
    if (!words.length) {
      setNotice('Введите хотя бы одно английское слово.');
      return;
    }
    setLearners(previous => previous.map(item => item.id === learner.id ? { ...item, assignedWords: Array.from(new Set([...item.assignedWords, ...words])) } : item));
    setAssignmentText('');
    setNotice(`Добавлено слов: ${words.length}. После подключения backend они появятся в заданиях ребёнка.`);
  };

  const saveReport = () => {
    if (reportsEnabled && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reportEmail)) {
      setNotice('Укажите корректную почту для еженедельного отчёта.');
      return;
    }
    setNotice(reportsEnabled ? `Еженедельный отчёт будет отправляться на ${reportEmail}.` : 'Еженедельный отчёт отключён.');
  };

  return (
    <ScreenContainer className="max-w-6xl pb-20">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={onBackHome} className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button>
        <div className="text-center"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">Premium</div><h1 className="text-2xl font-black text-indigo-950 sm:text-3xl">{userProfile.role === 'teacher' ? 'Комната преподавателя' : 'Комната родителя'}</h1></div>
        <button type="button" onClick={onOpenDictionaryStudio} className="rounded-2xl bg-indigo-600 px-3 py-2 text-sm font-black text-white sm:px-4">Словари</button>
      </div>
      {notice && <div className="mb-4 flex justify-between rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800"><span>{notice}</span><button onClick={() => setNotice(null)}>×</button></div>}
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border-2 border-indigo-50 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-indigo-400">Дети и ученики</h2>
          <div className="space-y-2">{learners.map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-2xl border-2 p-3 text-left ${selectedId === item.id ? 'border-indigo-300 bg-indigo-50' : 'border-indigo-50 bg-white'}`}><div className="font-black text-indigo-950">{item.name}</div><div className="text-xs font-bold text-gray-500">{item.classLabel || 'Личный профиль'} · точность {item.weeklyAccuracy}%</div></button>)}</div>
          <section className="mt-5 rounded-2xl bg-purple-50 p-3"><div className="text-xs font-black uppercase tracking-widest text-purple-500">Отчёт за неделю</div><label className="mt-3 flex items-center gap-2 text-sm font-bold text-indigo-950"><input type="checkbox" checked={reportsEnabled} onChange={event => setReportsEnabled(event.target.checked)} /> Отправлять на почту</label><input type="email" value={reportEmail} onChange={event => setReportEmail(event.target.value)} placeholder="parent@example.com" className="mt-3 w-full rounded-xl border border-purple-100 bg-white px-3 py-2 text-sm" /><button type="button" onClick={saveReport} className="mt-3 w-full rounded-xl bg-purple-600 py-2 text-sm font-black text-white">Сохранить</button></section>
        </aside>
        {learner && <main className="space-y-5">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-3xl bg-white p-4 shadow-sm"><div className="text-xs font-black text-indigo-400">ИГР</div><div className="text-3xl font-black text-indigo-950">{learner.stats.gamesPlayed}</div></div>
            <div className="rounded-3xl bg-white p-4 shadow-sm"><div className="text-xs font-black text-green-500">ПОБЕД</div><div className="text-3xl font-black text-indigo-950">{learner.stats.gamesWon}</div></div>
            <div className="rounded-3xl bg-white p-4 shadow-sm"><div className="text-xs font-black text-yellow-600">ТОЧНОСТЬ</div><div className="text-3xl font-black text-indigo-950">{learner.weeklyAccuracy}%</div></div>
            <div className="rounded-3xl bg-white p-4 shadow-sm"><div className="text-xs font-black text-purple-500">НАЗНАЧЕНО</div><div className="text-3xl font-black text-indigo-950">{learner.assignedWords.length}</div></div>
          </section>
          <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-indigo-950">Добавить слова в тренировки</h2>
            <p className="mt-1 text-sm font-bold text-gray-500">Слова появятся в персональном списке выбранного ребёнка.</p>
            <textarea value={assignmentText} onChange={event => setAssignmentText(event.target.value)} placeholder="APPLE, SCHOOL, TEACHER" className="mt-4 h-24 w-full rounded-2xl border-2 border-indigo-100 p-3 font-bold text-indigo-950" />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={addWords} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-black text-white">Назначить слова</button><button type="button" onClick={onOpenDictionaryStudio} className="rounded-xl border-2 border-indigo-100 px-5 py-2.5 font-black text-indigo-700">Распознать с фото</button></div>
            {learner.assignedWords.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{learner.assignedWords.map(word => <span key={word} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{word}</span>)}</div>}
          </section>
          <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-indigo-950">Подробная статистика по словам</h2>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[500px] text-sm"><thead className="text-left text-xs font-black uppercase tracking-widest text-indigo-300"><tr><th className="py-2">Слово</th><th>Попытки</th><th>Верно</th><th>Ошибки</th><th>Точность</th></tr></thead><tbody>{wordStats.map(word => <tr key={word.word} className="border-t border-indigo-50"><td className="py-3 font-black text-indigo-900">{word.word}</td><td>{word.attempts}</td><td className="text-green-700">{word.correct}</td><td className="text-rose-600">{word.mistakes}</td><td><span className={`rounded-full px-2 py-1 font-black ${formatAccuracy(word) < 60 ? 'bg-rose-50 text-rose-700' : 'bg-green-50 text-green-700'}`}>{formatAccuracy(word)}%</span></td></tr>)}</tbody></table></div>
          </section>
        </main>}
      </div>
    </ScreenContainer>
  );
};
