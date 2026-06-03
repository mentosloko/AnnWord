import React, { useEffect, useMemo, useState } from 'react';
import { familyAccountService } from '../../services/familyAccountService';
import { mentorRoomService } from '../../services/mentorRoomService';
import { CustomDictionaryCollection, ManagedLearner, UserProfile, WordPerformance } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface AdultRoomScreenProps {
  userProfile: UserProfile;
  onBackHome: () => void;
  onOpenDictionaryStudio: () => void;
}

const formatAccuracy = (word: WordPerformance): number => word.attempts > 0 ? Math.round(word.correct / word.attempts * 100) : 0;

export const AdultRoomScreen: React.FC<AdultRoomScreenProps> = ({ userProfile, onBackHome, onOpenDictionaryStudio }) => {
  const isParent = userProfile.role === 'parent';
  const isTeacher = userProfile.role === 'teacher';
  const [parentUnlocked, setParentUnlocked] = useState(!isParent);
  const [pin, setPin] = useState('');
  const [learners, setLearners] = useState<ManagedLearner[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [childCode, setChildCode] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const learner = learners.find(item => item.id === selectedId) || learners[0];
  const collections: CustomDictionaryCollection[] = userProfile.dictionaryCollections || [];
  const wordStats = useMemo(() => Object.values(learner?.stats.wordPerformance || {}).sort((left, right) => formatAccuracy(left) - formatAccuracy(right)), [learner]);

  const loadLearners = async () => {
    setIsLoading(true);
    try {
      const result = await mentorRoomService.loadLearners();
      if (!result.backendReady) { setNotice('Кабинет станет доступен после применения новой схемы данных.'); return; }
      setLearners(result.learners);
      setSelectedId(result.learners[0]?.id || '');
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'Не удалось загрузить данные ребёнка.');
    } finally { setIsLoading(false); }
  };

  useEffect(() => { if (parentUnlocked || isTeacher) void loadLearners(); }, [parentUnlocked, isTeacher]);

  const unlockParentRoom = async () => {
    if (!/^\d{4}$/.test(pin)) { setNotice('Введите PIN из 4 цифр.'); return; }
    setIsSaving(true); setNotice(null);
    try {
      const ok = await familyAccountService.verifyParentPin(pin);
      if (!ok) { setNotice('Неверный PIN.'); return; }
      setParentUnlocked(true); setPin('');
    } catch (error: unknown) { setNotice(error instanceof Error ? error.message : 'Не удалось проверить PIN.'); }
    finally { setIsSaving(false); }
  };

  const connectChild = async () => {
    setIsSaving(true); setNotice(null);
    try {
      await mentorRoomService.connectByChildCode(childCode);
      setChildCode('');
      setNotice('Ученик подключён. Теперь можно смотреть прогресс и назначать словари.');
      await loadLearners();
    } catch (error: unknown) { setNotice(error instanceof Error ? error.message : 'Не удалось подключить ученика.'); }
    finally { setIsSaving(false); }
  };

  const assignCollection = async () => {
    if (!learner) return;
    setIsSaving(true); setNotice(null);
    try {
      await mentorRoomService.assignCollection(learner.id, selectedCollectionId);
      const collection = collections.find(item => item.id === selectedCollectionId);
      setNotice(`Словарь «${collection?.title || 'Выбранная подборка'}» назначен ученику.`);
      await loadLearners();
    } catch (error: unknown) { setNotice(error instanceof Error ? error.message : 'Не удалось назначить словарь.'); }
    finally { setIsSaving(false); }
  };

  if (isParent && !parentUnlocked) return (
    <ScreenContainer className="max-w-md pb-20">
      <button type="button" onClick={onBackHome} className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button>
      <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-6 shadow-sm">
        <div className="text-xs font-black uppercase tracking-widest text-indigo-400">Для родителей</div>
        <h1 className="mt-2 text-2xl font-black text-indigo-950">Вход в кабинет</h1>
        <p className="mt-2 text-sm font-bold text-gray-500">Введите PIN, заданный при создании профиля ребёнка.</p>
        {notice && <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{notice}</div>}
        <input value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" placeholder="••••" className="mt-5 w-full rounded-xl border-2 border-indigo-100 px-4 py-3 text-center text-xl font-black tracking-[0.5em]" />
        <button type="button" disabled={isSaving} onClick={() => void unlockParentRoom()} className="mt-4 w-full rounded-xl bg-indigo-600 py-3 font-black text-white disabled:opacity-60">Открыть кабинет</button>
      </section>
    </ScreenContainer>
  );

  return (
    <ScreenContainer className="max-w-6xl pb-20">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={onBackHome} className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button>
        <div className="text-center"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">{isTeacher ? 'Преподаватель' : 'Родитель'}</div><h1 className="text-2xl font-black text-indigo-950 sm:text-3xl">{isTeacher ? 'Мои ученики' : 'Кабинет родителя'}</h1></div>
        <button type="button" onClick={onOpenDictionaryStudio} className="rounded-2xl bg-indigo-600 px-3 py-2 text-sm font-black text-white sm:px-4">Словари</button>
      </div>
      {notice && <div className="mb-4 flex justify-between rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>×</button></div>}
      {isTeacher && <section className="mb-5 rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-indigo-950">Подключить ученика</h2><p className="mt-1 text-sm font-bold text-gray-500">Введите код, который родитель видит в кабинете ребёнка.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={childCode} onChange={event => setChildCode(event.target.value.toUpperCase())} placeholder="Код ребёнка" className="flex-1 rounded-xl border-2 border-indigo-100 px-4 py-2.5 font-black uppercase" /><button type="button" disabled={isSaving} onClick={() => void connectChild()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-black text-white disabled:opacity-60">Подключить</button></div></section>}
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border-2 border-indigo-50 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-indigo-400">{isTeacher ? 'Ученики' : 'Ребёнок'}</h2>
          {isLoading ? <div className="rounded-2xl bg-indigo-50 p-4 text-sm font-bold text-indigo-600">Загружаю прогресс...</div> : learners.length ? <div className="space-y-2">{learners.map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-2xl border-2 p-3 text-left ${selectedId === item.id ? 'border-indigo-300 bg-indigo-50' : 'border-indigo-50 bg-white'}`}><div className="font-black text-indigo-950">{item.name}</div><div className="text-xs font-bold text-gray-500">Точность {item.weeklyAccuracy}%</div></button>)}</div> : <div className="rounded-2xl bg-indigo-50 p-4 text-sm font-bold text-indigo-700">{isTeacher ? 'Пока нет подключённых учеников. Введите код ребёнка выше.' : 'Профиль ребёнка не найден.'}</div>}
          {!isTeacher && learner?.childShareCode && <section className="mt-5 rounded-2xl bg-purple-50 p-3"><div className="text-xs font-black uppercase tracking-widest text-purple-500">Код для преподавателя</div><div className="mt-2 rounded-xl bg-white px-3 py-2 text-center text-xl font-black tracking-widest text-purple-800">{learner.childShareCode}</div><p className="mt-2 text-xs font-bold text-purple-700">Передайте код преподавателю, чтобы он видел прогресс и назначал словари.</p></section>}
          <section className="mt-5 rounded-2xl bg-gray-50 p-3"><div className="text-xs font-black uppercase tracking-widest text-gray-400">Отчёт за неделю</div><div className="mt-2 text-sm font-black text-gray-600">Будет позднее</div></section>
        </aside>
        {learner && <main className="space-y-5">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-3xl bg-white p-4 shadow-sm"><div className="text-xs font-black text-indigo-400">ИГР</div><div className="text-3xl font-black text-indigo-950">{learner.stats.gamesPlayed}</div></div><div className="rounded-3xl bg-white p-4 shadow-sm"><div className="text-xs font-black text-green-500">ПОБЕД</div><div className="text-3xl font-black text-indigo-950">{learner.stats.gamesWon}</div></div><div className="rounded-3xl bg-white p-4 shadow-sm"><div className="text-xs font-black text-yellow-600">ТОЧНОСТЬ</div><div className="text-3xl font-black text-indigo-950">{learner.weeklyAccuracy}%</div></div><div className="rounded-3xl bg-white p-4 shadow-sm"><div className="text-xs font-black text-purple-500">СЛОВ</div><div className="text-3xl font-black text-indigo-950">{learner.assignedWords.length}</div></div></section>
          {isTeacher && <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-indigo-950">Назначить словарь</h2><p className="mt-1 text-sm font-bold text-gray-500">Выберите одну из заранее созданных подборок.</p>{collections.length ? <div className="mt-4 flex flex-col gap-3 sm:flex-row"><select value={selectedCollectionId} onChange={event => setSelectedCollectionId(event.target.value)} className="flex-1 rounded-xl border-2 border-indigo-100 px-3 py-2.5 font-bold"><option value="">Выберите словарь</option>{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.title} · {collection.words.length} слов</option>)}</select><button type="button" disabled={isSaving || !selectedCollectionId} onClick={() => void assignCollection()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-black text-white disabled:opacity-50">Назначить</button></div> : <div className="mt-4 rounded-2xl bg-purple-50 p-4 text-sm font-bold text-purple-700">Сначала создайте словарь в разделе «Словари».</div>}</section>}
          <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-indigo-950">Слова в тренировках</h2>{learner.assignedWords.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{learner.assignedWords.map(word => <span key={word} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{word}</span>)}</div> : <p className="mt-3 text-sm font-bold text-gray-500">Пока нет назначенных словарей.</p>}</section>
          <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-indigo-950">Подробная статистика по словам</h2>{wordStats.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[500px] text-sm"><thead className="text-left text-xs font-black uppercase tracking-widest text-indigo-300"><tr><th className="py-2">Слово</th><th>Попытки</th><th>Верно</th><th>Ошибки</th><th>Точность</th></tr></thead><tbody>{wordStats.map(word => <tr key={word.word} className="border-t border-indigo-50"><td className="py-3 font-black text-indigo-900">{word.word}</td><td>{word.attempts}</td><td className="text-green-700">{word.correct}</td><td className="text-rose-600">{word.mistakes}</td><td><span className={`rounded-full px-2 py-1 font-black ${formatAccuracy(word) < 60 ? 'bg-rose-50 text-rose-700' : 'bg-green-50 text-green-700'}`}>{formatAccuracy(word)}%</span></td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm font-bold text-gray-500">Статистика появится после тренировок ребёнка.</p>}</section>
        </main>}
      </div>
    </ScreenContainer>
  );
};
