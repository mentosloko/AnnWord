import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { InventoryItem, UserProfile } from '../types';
import { applyItemUseLocally } from '../services/economyEngine';
import { getCharacterProgressPercent, getCharacterProgressText, getCharacterStageLabel } from '../services/gamificationRules';
import { getInventoryEmoji, getPetEmoji, getPetNeedSnapshot, getVisibleInventory } from '../services/petEngine';
import { getEquippedAccessoryAssetUrl, getInventoryImageUrl, getPuppyAccessoryOverlayClass } from '../services/petAssets';

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

const getCharacterPhrase = (profile: UserProfile): string => {
  const snapshot = getPetNeedSnapshot(profile.pet);
  if (snapshot.moodScore <= 20) return 'Я соскучился. Давай сыграем и поднимем настроение?';
  if (snapshot.moodScore <= 45) return 'Я готов к спокойной тренировке слов.';
  if (snapshot.moodScore <= 70) return 'Отличный момент для новой игры!';
  if ((profile.pet.level || 1) >= 5) return 'Я уже сильный знаток слов. Хочу новый вызов!';
  return 'Супернастроение! Давай продолжим учиться.';
};

const getAccessoryPositionClass = (itemId: string): string => {
  switch (itemId) {
    case 'hat': return '-top-10 left-1/2 -translate-x-1/2 text-5xl';
    case 'glasses': return 'top-10 left-1/2 -translate-x-1/2 text-4xl';
    case 'bow': return '-top-6 right-8 text-4xl rotate-12';
    case 'crown': return '-top-14 left-1/2 -translate-x-1/2 text-5xl';
    case 'hero_cape': return 'bottom-3 left-1/2 -translate-x-1/2 text-6xl opacity-80';
    case 'star_collar': return 'bottom-8 left-1/2 -translate-x-1/2 text-4xl';
    default: return '-top-8 right-6 text-4xl';
  }
};

export const PetRoom: React.FC<PetRoomProps> = ({ userProfile, onUseItem, onClose }) => {
  const [activeTab, setActiveTab] = useState<RoomTab>('food');
  const [usingId, setUsingId] = useState<string | null>(null);
  const [roomMessage, setRoomMessage] = useState<string | null>(null);
  const [speechText, setSpeechText] = useState<string>(getCharacterPhrase(userProfile));
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
      setSpeechText(getCharacterPhrase(userProfile));
    }
  }, [userProfile]);

  const setLocalAndRemember = (profile: UserProfile) => {
    setLocalProfile(profile);
    lastExternalProfileKey.current = getProfileSyncKey(profile);
    setSpeechText(getCharacterPhrase(profile));
  };

  const activeProfile = localProfile;
  const pet = activeProfile.pet;
  const petSnapshot = getPetNeedSnapshot(pet);
  const filteredInventory = getVisibleInventory(activeProfile, activeTab as InventoryItem['type']);
  const xpProgress = getCharacterProgressPercent(pet);

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
    <div className="flex flex-col p-3 sm:p-4 max-w-5xl mx-auto pb-24">
      <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 sm:mb-8">
        <button
          onClick={onClose}
          className="w-fit flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-bold transition px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
        >
          <span className="text-xl">←</span> На главный экран
        </button>
        <div className="text-sm font-bold text-indigo-600 uppercase tracking-widest">Комната персонажа</div>
        <div className="hidden sm:block w-16"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 lg:gap-10 items-start">
        <section className="rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-indigo-950">{pet.name}</h2>
              <p className="text-sm font-bold text-indigo-400 mt-1">
                Уровень {pet.level} · {getCharacterStageLabel(pet.stage)}
              </p>
            </div>
            <div className={`w-fit rounded-full px-4 py-1 text-xs font-black uppercase tracking-widest ${
              petSnapshot.attentionLevel === 'critical'
                ? 'bg-red-50 text-red-600 border border-red-100'
                : petSnapshot.attentionLevel === 'watch'
                  ? 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                  : 'bg-green-50 text-green-700 border border-green-100'
            }`}>
              {petSnapshot.statusLabel}
            </div>
          </div>

          <div className="relative aspect-square max-h-[560px] bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-[3rem] flex items-center justify-center border-4 border-white shadow-xl overflow-hidden">
            {pet.activeHomeItemId && (
              <div className="absolute bottom-8 left-8 text-6xl sm:text-7xl opacity-80">{getInventoryEmoji({ id: pet.activeHomeItemId, type: 'home', name: '', quantity: 1 })}</div>
            )}

            <motion.button
              type="button"
              aria-label="Поговорить с персонажем"
              onClick={() => setSpeechText(getCharacterPhrase(activeProfile))}
              whileTap={{ scale: 0.94, rotate: -2 }}
              animate={{
                y: petSnapshot.mood === 'sad' ? [0, -4, 0] : [0, -12, 0],
                rotate: [-1, 1, -1],
                scale: petSnapshot.mood === 'sad' ? [1, 0.99, 1] : [1, 1.025, 1],
              }}
              transition={{ repeat: Infinity, duration: petSnapshot.mood === 'sad' ? 4 : 3, ease: 'easeInOut' }}
              className="relative cursor-pointer focus:outline-none focus:ring-4 focus:ring-indigo-200 rounded-full w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center"
            >
              {(pet.equippedAccessories || []).map(accessoryId => {
                const assetUrl = getEquippedAccessoryAssetUrl(pet, accessoryId);
                if (!assetUrl || accessoryId !== 'hero_cape') return null;
                return (
                  <img
                    key={accessoryId}
                    src={assetUrl}
                    alt=""
                    aria-hidden="true"
                    className={`${getPuppyAccessoryOverlayClass(accessoryId)} pointer-events-none select-none`}
                    draggable={false}
                  />
                );
              })}
              <div className="relative z-20 text-[7rem] sm:text-[9rem] leading-none drop-shadow-sm">{getPetEmoji(pet)}</div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                {(pet.equippedAccessories || []).map(accessoryId => {
                  const assetUrl = getEquippedAccessoryAssetUrl(pet, accessoryId);
                  if (assetUrl && accessoryId !== 'hero_cape') {
                    return (
                      <img
                        key={accessoryId}
                        src={assetUrl}
                        alt=""
                        aria-hidden="true"
                        className={`${getPuppyAccessoryOverlayClass(accessoryId)} pointer-events-none select-none`}
                        draggable={false}
                      />
                    );
                  }
                  if (assetUrl) return null;
                  return (
                    <div key={accessoryId} className={`absolute ${getAccessoryPositionClass(accessoryId)}`}>
                      {getInventoryEmoji({ id: accessoryId, type: 'accessory', name: '', quantity: 1 })}
                    </div>
                  );
                })}
              </div>
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              key={speechText}
              className="absolute top-5 left-5 right-5 rounded-3xl bg-white/90 border-2 border-indigo-50 px-4 py-3 text-sm font-bold text-indigo-900 shadow-sm"
            >
              “{speechText}”
            </motion.div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-3xl bg-indigo-50 border border-indigo-100 p-4">
              <div className="flex items-center justify-between mb-2 text-xs font-black text-indigo-400 uppercase tracking-widest">
                <span>XP</span>
                <span title="XP даётся за завершение игр. Победа даёт больше опыта, но небольшая награда есть и за попытку.">{pet.xp}</span>
              </div>
              <div className="h-3 bg-white rounded-full overflow-hidden border border-indigo-100">
                <motion.div initial={{ width: 0 }} animate={{ width: `${xpProgress}%` }} className="h-full bg-indigo-500" />
              </div>
              <div className="mt-2 text-[11px] font-bold text-indigo-500">{getCharacterProgressText(pet)}</div>
            </div>

            <div className="rounded-3xl bg-green-50 border border-green-100 p-4">
              <div className="flex items-center justify-between mb-2 text-xs font-black text-green-500 uppercase tracking-widest">
                <span>Настроение</span>
                <span title="Игры повышают настроение до 70/100. Лакомства могут поднять его выше.">{petSnapshot.moodScore}/100</span>
              </div>
              <div className="h-3 bg-white rounded-full overflow-hidden border border-green-100">
                <motion.div initial={{ width: 0 }} animate={{ width: `${petSnapshot.moodScore}%` }} className="h-full bg-green-500" />
              </div>
              <div className="mt-2 text-[11px] font-bold text-green-600">{petSnapshot.statusLabel}</div>
            </div>
          </div>
        </section>

        <aside className="flex flex-col bg-white rounded-[3rem] p-5 sm:p-6 border-2 border-indigo-50 shadow-sm min-h-[420px]">
          {roomMessage && (
            <div className="mb-5 rounded-2xl border-2 border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">
              {roomMessage}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-6 bg-indigo-50 p-1 rounded-2xl w-fit">
            {(['food', 'accessory', 'home'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setRoomMessage(null); }}
                className={`px-4 py-2 rounded-xl font-bold transition-all ${
                  activeTab === tab ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-400 hover:text-indigo-600'
                }`}
              >
                {getTabLabel(tab)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-4 overflow-y-auto max-h-[360px] pr-1 custom-scrollbar">
            {filteredInventory.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400 text-center">
                <span className="text-4xl mb-2">📦</span>
                <p className="text-sm font-bold">Пока здесь пусто</p>
                <p className="mt-1 text-xs">Сыграй в игры, заработай монеты и загляни в магазин.</p>
              </div>
            ) : (
              filteredInventory.map(item => {
                const isActive = pet.equippedAccessories?.includes(item.id) || pet.activeHomeItemId === item.id;
                const itemImageUrl = getInventoryImageUrl(item, pet);
                return (
                  <motion.button
                    type="button"
                    key={item.id}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleUse(item.id)}
                    className={`aspect-square rounded-3xl p-3 cursor-pointer border-2 transition-all flex flex-col items-center justify-center relative ${
                      isActive
                        ? 'bg-indigo-600 border-indigo-700 text-white'
                        : 'bg-indigo-50 border-indigo-100 text-indigo-900 hover:bg-indigo-100'
                    }`}
                  >
                    {itemImageUrl ? (
                      <img src={itemImageUrl} alt="" className="w-14 h-14 object-contain mb-2" aria-hidden="true" draggable={false} />
                    ) : (
                      <div className="text-4xl mb-2">{getInventoryEmoji(item)}</div>
                    )}
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
                  </motion.button>
                );
              })
            )}
          </div>

          <div className="mt-auto pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 font-medium">{getUseHint(activeTab)}</p>
          </div>
        </aside>
      </div>
    </div>
  );
};