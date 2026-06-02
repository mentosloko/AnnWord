import React, { useEffect, useMemo, useState } from 'react';
import { adminRcAccessService, AdminRcProfile, RC_FEATURE_LABELS } from '../../services/adminRcAccessService';
import { AccountRole, FeatureFlags } from '../../types';

const allFlags = (): FeatureFlags => Object.fromEntries(RC_FEATURE_LABELS.map(feature => [feature.key, true])) as FeatureFlags;
const roleLabel: Record<AccountRole, string> = { user: 'Игрок', parent: 'Родитель', teacher: 'Преподаватель', admin: 'Администратор' };

export const AdminRcAccessPanel: React.FC = () => {
  const [profiles, setProfiles] = useState<AdminRcProfile[]>([]);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [role, setRole] = useState<AccountRole>('user');
  const [premium, setPremium] = useState(false);
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [adultUsername, setAdultUsername] = useState('');
  const [learnerUsername, setLearnerUsername] = useState('');
  const [relationRole, setRelationRole] = useState<'parent' | 'teacher'>('parent');
  const [classLabel, setClassLabel] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadProfiles = async () => {
    setIsLoading(true);
    try {
      const data = await adminRcAccessService.listProfiles();
      setProfiles(data);
      if (!selectedUsername && data.length) setSelectedUsername(data[0].username);
    } catch {
      setStatus('Управление тестовым доступом станет доступно после применения миграции выпуска.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadProfiles(); }, []);
  const selected = useMemo(() => profiles.find(profile => profile.username === selectedUsername), [profiles, selectedUsername]);
  useEffect(() => {
    if (!selected) return;
    setRole(selected.role);
    setPremium(selected.subscriptionTier === 'premium');
    setFlags(selected.featureFlags);
  }, [selected]);

  const saveAccess = async () => {
    if (!selectedUsername) return;
    setIsSaving(true); setStatus(null);
    try {
      await adminRcAccessService.setAccess(selectedUsername, role, premium, flags);
      setStatus(`Доступ обновлён: ${selectedUsername}.`);
      await loadProfiles();
    } catch { setStatus('Не удалось сохранить доступ. Проверьте применение миграции и роль администратора.'); }
    finally { setIsSaving(false); }
  };
  const enableFullRc = async () => {
    setPremium(true); setFlags(allFlags());
    setStatus('Все функции выбраны. Нажмите «Сохранить доступ».');
  };
  const linkLearner = async () => {
    if (!adultUsername.trim() || !learnerUsername.trim()) { setStatus('Укажите взрослого и ребёнка.'); return; }
    setIsSaving(true); setStatus(null);
    try {
      await adminRcAccessService.linkLearner(adultUsername, learnerUsername, relationRole, classLabel);
      setStatus('Связь взрослого с ребёнком сохранена.');
    } catch { setStatus('Не удалось сохранить связь. Проверьте имена профилей и их роли.'); }
    finally { setIsSaving(false); }
  };

  return <section className="rounded-[2rem] border border-purple-100 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black text-indigo-950">Закрытый релиз функций</h2><p className="mt-1 text-sm font-semibold text-gray-500">Роли, Premium и функции для тестовых аккаунтов. Остальные игроки изменений не увидят.</p></div><button type="button" onClick={() => void loadProfiles()} className="rounded-xl border border-indigo-100 px-4 py-2 text-sm font-black text-indigo-700">Обновить</button></div>
    {status && <div className="mt-4 rounded-2xl bg-purple-50 px-4 py-3 text-sm font-bold text-purple-800">{status}</div>}
    {!isLoading && profiles.length > 0 && <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl bg-indigo-50/50 p-4"><h3 className="font-black text-indigo-950">Доступ профиля</h3>
        <select value={selectedUsername} onChange={event => setSelectedUsername(event.target.value)} className="mt-3 w-full rounded-xl border border-indigo-100 bg-white px-3 py-2 font-bold">{profiles.map(profile => <option key={profile.id} value={profile.username}>{profile.username}</option>)}</select>
        <div className="mt-3 grid gap-2 sm:grid-cols-2"><select value={role} onChange={event => setRole(event.target.value as AccountRole)} className="rounded-xl border border-indigo-100 bg-white px-3 py-2 font-bold">{(Object.keys(roleLabel) as AccountRole[]).map(value => <option key={value} value={value}>{roleLabel[value]}</option>)}</select><label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold"><input type="checkbox" checked={premium} onChange={event => setPremium(event.target.checked)} /> Premium</label></div>
        <div className="mt-3 space-y-2">{RC_FEATURE_LABELS.map(feature => <label key={feature.key} className="flex items-center gap-2 text-sm font-bold text-indigo-900"><input type="checkbox" checked={flags[feature.key] === true} onChange={event => setFlags(current => ({ ...current, [feature.key]: event.target.checked }))} />{feature.label}</label>)}</div>
        <div className="mt-4 flex gap-2"><button type="button" onClick={() => void enableFullRc()} className="rounded-xl border border-purple-200 px-3 py-2 text-sm font-black text-purple-700">Выбрать всё</button><button type="button" disabled={isSaving} onClick={() => void saveAccess()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Сохранить доступ</button></div>
      </div>
      <div className="rounded-2xl bg-purple-50/50 p-4"><h3 className="font-black text-indigo-950">Связать взрослого и ребёнка</h3><input value={adultUsername} onChange={event => setAdultUsername(event.target.value)} placeholder="Имя взрослого" className="mt-3 w-full rounded-xl border border-purple-100 bg-white px-3 py-2 font-bold"/><input value={learnerUsername} onChange={event => setLearnerUsername(event.target.value)} placeholder="Имя ребёнка" className="mt-2 w-full rounded-xl border border-purple-100 bg-white px-3 py-2 font-bold"/><div className="mt-2 grid gap-2 sm:grid-cols-2"><select value={relationRole} onChange={event => setRelationRole(event.target.value as 'parent' | 'teacher')} className="rounded-xl border border-purple-100 bg-white px-3 py-2 font-bold"><option value="parent">Родитель</option><option value="teacher">Преподаватель</option></select><input value={classLabel} onChange={event => setClassLabel(event.target.value)} placeholder="Класс, например 3А" className="rounded-xl border border-purple-100 bg-white px-3 py-2 font-bold"/></div><button type="button" disabled={isSaving} onClick={() => void linkLearner()} className="mt-4 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Сохранить связь</button></div>
    </div>}
  </section>;
};