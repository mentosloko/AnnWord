import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { InventoryItem, UserProfile } from '../types';
import { applyItemUseLocally, getPurchaseErrorMessage } from '../services/economyEngine';
import { getCharacterProgressPercent, getCharacterProgressText, getCharacterStageLabel } from '../services/gamificationRules';
import { getInventoryEmoji, getPetEmoji, getPetNeedSnapshot, getVisibleInventory } from '../services/petEngine';
import { getInventoryImageUrl, getPuppyCharacterAssetUrl } from '../services/petAssets';

interface PetRoomProps {
  userProfile: UserProfile;
  onUseItem: (itemId: string) => Promise<void>;
  onClose: () => void;
}

type RoomTab = 'food' | 'accessory' | 'home';
type VisibleRoomTab = Exclude<RoomTab, 'home'>;

const VISIBLE_ROOM_TABS: VisibleRoomTab[] = ['food', 'accessory'];

const ROOM_BACKGROUND_BY_PET_TYPE: Record<string, string> = {
  Puppy: '/assets/rooms/puppy/background.webp',
};

const getProfileSyncKey = (profile: UserProfile): string =>
  `${profile.username}|${profile.pet.name}|${profile.pet.type}|${profile.pet.level}|${profile.pet.xp}|${profile.pet.moodScore}|${profile.pet.mood}|${profile.pet.activeHomeItemId || ''}|${JSON.stringify(profile.pet.equippedAccessories || [])}|${JSON.stringify(profile.inventory || [])}`;

const getTabLabel = (tab: RoomTab): string => {
  if (tab === 'food') return 'Лакомства';
  if (tab === 'accessory') return 'Гардероб';
  return 'Комната';
};

const getUseHint = (tab: RoomTab): string => {
  if (tab === 'food') return 'Лакомства поднимают настроение питомца. Одно нажатие — одно угощение.';
  if (tab === 'accessory') return 'Можно надеть максимум 2 аксессуара. Повторное нажатие снимает предмет.';
  return 'Предмет комнаты можно поставить в комнату или убрать повторным нажатием.';
};

const getCharacterPhrase = (profile: UserProfile): string => {
  const snapshot = getPetNeedSnapshot(profile.pet);
  if (snapshot.moodScore <= 20) return 'Я соскучился. Давай сыграем и поднимем настроение?';
  if (snapshot.moodScore <= 45) return 'Я готов к спокойной тренировке слов.';
  if (snapshot.moodScore <= 70) return 'Отличный момент для новой игры!';
  if ((profile.pet.level || 1) >= 5) return 'Я уже сильный знаток слов. Хочу новый вызов!';
  return 'Супернастроение! Давай продолжим учиться.';
};

const InventoryCard: React.FC<{
  item: InventoryItem;
  isActive: boolean;
  isUsing: boolean;
  onUse: (itemId: string) => void;
}> = ({ item, isActive, isUsing, onUse }) => {
  const itemImageUrl = getInventoryImageUrl(item);

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={() => onUse(item.id)}
      className={`relative flex min-h-[108px] items-center gap-4 rounded-3xl border-2 p-4 text-left shadow-sm transition-all ${
        isActive
          ? 'border-indigo-500 bg-indigo-600 text-white shadow-indigo-100'
          : 'border-indigo-100 bg-white text-indigo-950 hover:bg-indigo-50'
      }`}
    >
      <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl ${isActive ? 'bg-white/15' : 'bg-indigo-50'}`}>
        {itemImageUrl ? (
          <img src={itemImageUrl} alt="" className="h-16 w-16 object-contain" aria-hidden="true" draggable={false} />
        ) : (
          <span className="text-4xl">{getInventoryEmoji(item)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-base font-black leading-tight">{item.name}</div>
        <div className={`mt-1 text-xs font-bold ${isActive ? 'text-white/75' : 'text-indigo-400'}`}>
          {isActive ? 'Активно' : item.type === 'food' ? 'Угостить питомца' : item.type === 'accessory' ? 'Надеть' : 'Поставить в комнату'}
        </div>
      </div>
      {item.quantity > 1 && (
        <div className="absolute right-3 top-3 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-red-500 px-2 text-xs font-black text-white">
          {item.quantity}
        </div>
      )}
      {isUsing && (
        <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-white/55">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      )}
    </motion.button>
  );
};

export const PetRoom: React.FC<PetRoomProps> = ({ userProfile, onUseItem, onClose }) => {
  const [activeTab, setActiveTab] = useState<VisibleRoomTab>('food');
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
  const puppyCharacterAssetUrl = getPuppyCharacterAssetUrl(pet);
  const filteredInventory = getVisibleInventory(activeProfile, activeTab as InventoryItem['type']);
  const activeHomeItem = pet.activeHomeItemId
    ? getVisibleInventory(activeProfile, 'home').find(item => item.id === pet.activeHomeItemId)
    : null;
  const xpProgress = getCharacterProgressPercent(pet);
  const roomBackgroundUrl = ROOM_BACKGROUND_BY_PET_TYPE[pet.type];
  const hasCustomRoomBackground = Boolean(roomBackgroundUrl);
  const petSlotClassName = hasCustomRoomBackground
    ? 'absolute bottom-[5.5rem] left-[50%] z-10 flex h-56 w-56 -translate-x-1/2 cursor-pointer items-center justify-center rounded-[3rem] focus:outline-none focus:ring-4 focus:ring-indigo-200 sm:bottom-[5.9rem] sm:h-72 sm:w-72'
    : 'absolute bottom-24 left-1/2 z-10 flex h-56 w-56 -translate-x-1/2 cursor-pointer items-center justify-center rounded-[3rem] focus:outline-none focus:ring-4 focus:ring-indigo-200 sm:h-72 sm:w-72';
  const petImageClassName = hasCustomRoomBackground
    ? 'h-full w-full translate-x-[-30%] translate-y-[4%] select-none object-contain drop-shadow-sm'
    : 'h-full w-full select-none object-contain drop-shadow-sm';
  const petFallbackClassName = hasCustomRoomBackground
    ? 'translate-x-[-30%] translate-y-[4%] text-[7rem] leading-none drop-shadow-sm sm:text-[9rem]'
    : 'text-[7rem] leading-none drop-shadow-sm sm:text-[9rem]';

  const handleUse = async (itemId: string) => {
    if (usingId) return;
    const optimisticUse = applyItemUseLocally(activeProfile, itemId);
    if (!optimisticUse.ok || !optimisticUse.profile) {
      setRoomMessage(getPurchaseErrorMessage(optimisticUse.reason));
      return;
    }

    setLocalAndRemember(optimisticUse.profile);
    setRoomMessage(null);
    setUsingId(itemId);

    try {
      await onUseItem(itemId);
      if (mountedRef.current) setRoomMessage('Готово: комната обновлена.');
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
    <div className="mx-auto flex max-w-6xl flex-col px-3 pb-24 pt-3 sm:px-4 sm:pt-4">
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50"
          aria-label="На главный экран"
        >
          ←
        </button>
        <div className="text-center">
          <h1 className="text-xl font-black text-indigo-950 sm:text-3xl">Комната питомца</h1>
          <div className="text-xs font-black uppercase tracking-widest text-indigo-300">{pet.name}</div>
        </div>
        <div className="h-11 w-11" />
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <div className="overflow-hidden rounded-[2rem] border-2 border-white bg-white shadow-sm sm:rounded-[2.5rem]">
          <div
            className={`relative min-h-[420px] overflow-hidden sm:min-h-[540px] ${hasCustomRoomBackground ? 'bg-sky-50 bg-cover bg-center bg-no-repeat' : 'bg-gradient-to-b from-sky-100 via-indigo-50 to-amber-50'}`}
            style={hasCustomRoomBackground ? { backgroundImage: `url('${roomBackgroundUrl}')` } : undefined}
          >
            {!hasCustomRoomBackground && (
              <>
                <div className="absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.85),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(129,140,248,0.18),transparent_26%)]" />
                <div className="absolute left-8 top-8 h-24 w-24 rounded-[2rem] border-8 border-white bg-gradient-to-br from-cyan-100 to-blue-200 shadow-inner sm:left-12 sm:top-10 sm:h-32 sm:w-32">
                  <div className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-white/80" />
                  <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 bg-white/80" />
                </div>
                <div className="absolute right-8 top-20 hidden h-4 w-32 rounded-full bg-indigo-200/60 sm:block" />
                <div className="absolute right-14 top-14 hidden h-16 w-16 rounded-3xl bg-white/70 text-center text-3xl leading-[4rem] shadow-sm sm:block">📚</div>

                <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-br from-amber-100 via-orange-100 to-yellow-50">
                  <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(90deg,rgba(180,83,9,0.18)_1px,transparent_1px),linear-gradient(rgba(180,83,9,0.12)_1px,transparent_1px)] [background-size:52px_52px]" />
                </div>
                <div className="absolute bottom-16 left-1/2 h-24 w-[68%] -translate-x-1/2 rounded-[50%] bg-indigo-200/45 blur-sm" />
                <div className="absolute bottom-14 left-1/2 h-20 w-[64%] -translate-x-1/2 rounded-[50%] border-4 border-white/70 bg-gradient-to-r from-indigo-100 to-purple-100 shadow-inner" />
              </>
            )}

            {activeHomeItem && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-24 left-6 flex flex-col items-center rounded-3xl bg-white/75 p-3 shadow-sm backdrop-blur sm:left-10"
              >
                {getInventoryImageUrl(activeHomeItem) ? (
                  <img src={getInventoryImageUrl(activeHomeItem)} alt="" className="h-20 w-20 object-contain" aria-hidden="true" draggable={false} />
                ) : (
                  <span className="text-6xl">{getInventoryEmoji(activeHomeItem)}</span>
                )}
                <span className="mt-1 max-w-[120px] truncate text-xs font-black text-indigo-700">{activeHomeItem.name}</span>
              </motion.div>
            )}

            <div className="absolute bottom-[5.2rem] left-1/2 h-12 w-48 -translate-x-1/2 rounded-[50%] bg-indigo-950/15 blur-md sm:bottom-[5.6rem] sm:w-56" />

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
              className={petSlotClassName}
            >
              {puppyCharacterAssetUrl ? (
                <img
                  src={puppyCharacterAssetUrl}
                  alt={pet.name}
                  className={petImageClassName}
                  draggable={false}
                />
              ) : (
                <div className={petFallbackClassName}>{getPetEmoji(pet)}</div>
              )}
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              key={speechText}
              className="absolute left-4 right-4 top-4 z-20 rounded-3xl border-2 border-indigo-50 bg-white/90 px-4 py-3 text-sm font-bold text-indigo-900 shadow-sm backdrop-blur sm:left-auto sm:right-6 sm:top-6 sm:w-80"
            >
              “{speechText}”
            </motion.div>
          </div>
        </div>

        <aside className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm">
            <div className="mb-1 text-xs font-black uppercase tracking-widest text-indigo-300">Питомец</div>
            <div className="text-2xl font-black text-indigo-950">{pet.name}</div>
            <div className="mt-1 text-sm font-bold text-indigo-500">Уровень {pet.level} · {getCharacterStageLabel(pet.stage)}</div>
            <div className={`mt-4 w-fit rounded-full px-4 py-1 text-xs font-black uppercase tracking-widest ${
              petSnapshot.attentionLevel === 'critical'
                ? 'border border-red-100 bg-red-50 text-red-600'
                : petSnapshot.attentionLevel === 'watch'
                  ? 'border border-yellow-100 bg-yellow-50 text-yellow-700'
                  : 'border border-green-100 bg-green-50 text-green-700'
            }`}>
              {petSnapshot.statusLabel}
            </div>
          </div>

          <div className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between text-xs font-black uppercase tracking-widest text-indigo-300">
              <span>XP</span>
              <span>{pet.xp}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full border border-indigo-100 bg-indigo-50">
              <motion.div initial={{ width: 0 }} animate={{ width: `${xpProgress}%` }} className="h-full bg-indigo-500" />
            </div>
            <div className="mt-2 text-xs font-bold text-indigo-500">{getCharacterProgressText(pet)}</div>

            <div className="mt-5 mb-3 flex items-center justify-between text-xs font-black uppercase tracking-widest text-green-500">
              <span>Настроение</span>
              <span>{petSnapshot.moodScore}/100</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full border border-green-100 bg-green-50">
              <motion.div initial={{ width: 0 }} animate={{ width: `${petSnapshot.moodScore}%` }} className="h-full bg-green-500" />
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-5 rounded-[2rem] border-2 border-indigo-50 bg-white p-4 shadow-sm sm:mt-6 sm:p-5">
        {roomMessage && (
          <div className="mb-4 rounded-2xl border-2 border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">
            {roomMessage}
          </div>
        )}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-indigo-950">Предметы питомца</h2>
            <p className="mt-1 text-xs font-bold text-indigo-400">{getUseHint(activeTab)}</p>
          </div>
          <div className="flex w-fit flex-wrap gap-2 rounded-2xl bg-indigo-50 p-1">
            {VISIBLE_ROOM_TABS.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => { setActiveTab(tab); setRoomMessage(null); }}
                className={`rounded-xl px-4 py-2 font-bold transition-all ${
                  activeTab === tab ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-400 hover:text-indigo-600'
                }`}
              >
                {getTabLabel(tab)}
              </button>
            ))}
          </div>
        </div>

        {filteredInventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-indigo-100 bg-indigo-50/50 py-12 text-center text-gray-400">
            <span className="mb-2 text-4xl">📦</span>
            <p className="text-sm font-bold">Пока здесь пусто</p>
            <p className="mt-1 text-xs">Сыграй в игры, заработай монеты и загляни в магазин.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredInventory.map(item => {
              const isActive = pet.equippedAccessories?.includes(item.id) || pet.activeHomeItemId === item.id;
              return (
                <InventoryCard
                  key={item.id}
                  item={item}
                  isActive={Boolean(isActive)}
                  isUsing={usingId === item.id}
                  onUse={handleUse}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};