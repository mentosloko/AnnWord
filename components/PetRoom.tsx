import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { InventoryItem, UserProfile } from '../types';
import { applyItemUseLocally } from '../services/economyEngine';
import { getCharacterProgressText } from '../services/gamificationRules';
import { getInventoryEmoji, getPetEmoji, getPetNeedSnapshot, getVisibleInventory } from '../services/petEngine';

interface PetRoomProps {
  userProfile: UserProfile;
  onUseItem: (itemId: string) => Promise<void>;
  onClose: () => void;
}

type RoomTab = 'food' | 'accessory' | 'home';

const getProfileSyncKey = (profile: UserProfile): string =>
  `${profile.username}|${profile.pet.name}|${profile.pet.type}|${profile.pet.level}|${profile.pet.xp}|${profile.pet.moodScore}|${profile.pet.mood}|${profile.pet.activeHomeItemId || ''}|${JSON.stringify(profile.pet.equippedAccessories || [])}|${JSON.stringify(profile.inventory || [])}`;

const getTabLabel = (tab: RoomTab): string => {
  if (tab === 'food') return 'Лакомства';
  if (tab === 'accessory') return 'Гардероб';
  return 'Домик';
};

const getUseHint = (tab: RoomTab): string => {
  if (tab === 'food') return 'Нажми, чтобы подарить лакомство и поднять настроение';
  if (tab === 'accessory') return 'Нажми, чтобы надеть или снять аксессуар';
  return 'Нажми, чтобы поставить или убрать предмет домика';
};

export const PetRoom: React.FC<PetRoomProps> = ({ userProfile, onUseItem, onClose }) => {
  const [activeTab, setActiveTab] = useState<RoomTab>('food');
  const [usingId, setUsingId] = useState<string | null>(null);
  const [roomMessage, setRoomMessage] = useState<string | null>(null);
  const [localProfile, setLocalProfile] = useState<UserProfile>(userProfile);
  const lastExternalProfileKey = useRef(getProfileSyncKey(userProfile));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const nextExternalKey = getProfileSyncKey(userProfile);
    if (nextExternalKey !== lastExternalProfileKey.current) {
      lastExternalProfileKey.current = nextExternalKey;
      setLocalProfile(userProfile);
    }
  }, [userProfile]);

  const setLocalAndRemember = (profile: UserProfile) => {
    setLocalProfile(profile);
    lastExternalProfileKey.current = getProfileSyncKey(profile);
  };

  const activeProfile = localProfile;
  const pet = activeProfile.pet;
  const petSnapshot = getPetNeedSnapshot(pet);
  const filteredInventory = getVisibleInventory(activeProfile, activeTab as InventoryItem['type']);

  const handleUse = async (itemId: string) => {
    if (usingId) return;
    const optimisticUse = applyItemUseLocally(activeProfile, itemId);
    if (!optimisticUse.ok || !optimisticUse.profile) {
      setRoomMessage('Предмет не найден или его нельзя использовать.');
      return;
    }

    setLocalAndRemember(optimisticUse.profile);
    setRoomMessage(null);
    setUsingId(itemId);

    try {
      await onUseItem(itemId);
      if (mountedRef.current) setRoomMessage('Готово: персонаж обновлён.');
    } catch (error: any) {
      if (mountedRef.current) {
        setLocalAndRemember(userProfile);
        setRoomMessage(error?.message || 'Не удалось использовать предмет.');
      }
    } finally {
      if (mountedRef.current) setUsingId(null);
    }
  };

  return (
    <div className="flex flex-col p-4 max-w-4xl mx-auto">
      <div className="w-full flex justify-between items-center mb-8">
        <button 
          onClick={onClose} 
          className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-bold transition px-3 py-1 bg-gray-50 rounded-lg border border-gray-200"
        >
          <span className="text-xl">←</span> На главный экран
        </button>
        <div className="text-sm font-bold text-indigo-600 uppercase tracking-widest">Комната персонажа</div>
        <div className="w-16"></div>
      </div>

      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 mb-12">
        <div className="flex flex-col">
          <h2 className="text-3xl font-bold text-indigo-900">Твой персонаж</h2>
          <div className={`mt-2 w-fit rounded-full px-4 py-1 text-xs font-black uppercase tracking-widest ${
            petSnapshot.attentionLevel === 'critical'
              ? 'bg-red-50 text-red-600 border border-red-100'
              : petSnapshot.attentionLevel === 'watch'
                ? 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                : 'bg-green-50 text-green-700 border border-green-100'
          }`}>
            {petSnapshot.statusLabel}
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-3xl shadow-sm border-2 border-indigo-50">
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Настроение</span>
            <div className="w-44 h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${petSnapshot.moodScore}%` }}
                className={`h-full transition-all ${
                  petSnapshot.moodScore <= 20 ? 'bg-red-500' : petSnapshot.moodScore <= 45 ? 'bg-yellow-500' : petSnapshot.moodScore <= 70 ? 'bg-green-500' : 'bg-indigo-500'
                }`}
              />
            </div>
            <span className="mt-1 text-xs font-bold text-indigo-500">{petSnapshot.moodScore}/100</span>
          </div>
        </div>
      </div>

      {roomMessage && (
        <div className="mb-6 rounded-2xl border-2 border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">
          {roomMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="relative aspect-square bg-gradient-to-br from-indigo-50 to-white rounded-[4rem] flex items-center justify-center border-4 border-white shadow-xl">
          {pet.activeHomeItemId && (
            <div className="absolute bottom-8 left-8 text-6xl opacity-80">{getInventoryEmoji({ id: pet.activeHomeItemId, type: 'home', name: '', quantity: 1 })}</div>
          )}
          <motion.div
            animate={{ 
              y: [0, -10, 0],
              scale: petSnapshot.mood === 'sad' ? [1, 0.98, 1] : [1, 1.02, 1]
            }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="relative"
          >
            <div className="text-9xl">{getPetEmoji(pet)}</div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {pet.equippedAccessories?.includes('hat') && <div className="absolute -top-10 text-5xl">🧢</div>}
              {pet.equippedAccessories?.includes('glasses') && <div className="absolute top-4 text-4xl">🕶️</div>}
              {pet.equippedAccessories?.includes('bow') && <div className="absolute -top-8 text-4xl">🎀</div>}
              {pet.equippedAccessories?.includes('crown') && <div className="absolute -top-12 text-5xl">👑</div>}
            </div>
          </motion.div>

          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-white px-8 py-2 rounded-2xl shadow-lg border-2 border-indigo-50 min-w-48 text-center">
            <h3 className="text-2xl font-black text-indigo-900">{pet.name}</h3>
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest text-center">Уровень {pet.level} · {pet.stage || 'stage_1'}</p>
            <p className="text-[11px] font-bold text-gray-400 mt-1">{getCharacterProgressText(pet)}</p>
          </div>
        </div>

        <div className="flex flex-col bg-white rounded-[3rem] p-8 border-2 border-indigo-50 shadow-sm min-h-[400px]">
          <div className="flex gap-2 mb-8 bg-indigo-50 p-1 rounded-2xl w-fit">
            {(['food', 'accessory', 'home'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setRoomMessage(null); }}
                className={`px-6 py-2 rounded-xl font-bold transition-all ${
                  activeTab === tab ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-400 hover:text-indigo-600'
                }`}
              >
                {getTabLabel(tab)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {filteredInventory.length === 0 ? (
              <div className="col-span-3 flex flex-col items-center justify-center py-12 text-gray-400">
                <span className="text-4xl mb-2">📦</span>
                <p className="text-sm font-medium">Пусто</p>
              </div>
            ) : (
              filteredInventory.map(item => (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleUse(item.id)}
                  className={`aspect-square rounded-3xl p-2 cursor-pointer border-2 transition-all flex flex-col items-center justify-center relative ${
                    pet.equippedAccessories?.includes(item.id) || pet.activeHomeItemId === item.id || pet.type === item.name
                      ? 'bg-indigo-600 border-indigo-700 text-white' 
                      : 'bg-indigo-50 border-indigo-100 text-indigo-900 hover:bg-indigo-100'
                  }`}
                >
                  <div className="text-3xl mb-1">{getInventoryEmoji(item)}</div>
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-center line-clamp-1">{item.name}</span>
                  {item.quantity > 1 && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                      {item.quantity}
                    </div>
                  )}
                  {usingId === item.id && (
                    <div className="absolute inset-0 bg-white/50 rounded-3xl flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>

          <div className="mt-auto pt-8 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 font-medium">{getUseHint(activeTab)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
