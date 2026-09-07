import type { GameSettings, UserProfile } from '../types';
import { getKidsDictionaryMeta } from './kidsDictionaryCatalog';
import { getPremiumDictionaryCatalog } from './premiumDictionaryCatalog';
import { getSpotlightCompactSelectionLabel, SPOTLIGHT_PREMIUM_DICTIONARY_ID } from './spotlightDictionary';

export type ActiveDictionaryDescriptor = {
  title: string;
  icon: string;
  available: boolean;
};

export const resolveActiveDictionaryDescriptor = (
  settings: GameSettings,
  profile: UserProfile,
  kidsMode: boolean,
): ActiveDictionaryDescriptor => {
  const assignedCount = kidsMode ? (profile.assignedWords || []).length : 0;

  if (settings.dictionarySource === 'custom' || settings.useCustomDictionary) {
    return {
      title: assignedCount ? 'Свои слова и слова преподавателя' : 'Слова из вашего списка',
      icon: '📖',
      available: true,
    };
  }

  if (settings.dictionarySource === 'premium') {
    if (settings.activePremiumDictionaryId === SPOTLIGHT_PREMIUM_DICTIONARY_ID) {
      const grade = settings.activeSpotlightGrade;
      const sectionIds = settings.activeSpotlightSectionIds?.length
        ? settings.activeSpotlightSectionIds
        : settings.activeSpotlightSectionId;
      const selection = grade ? getSpotlightCompactSelectionLabel(grade, sectionIds) : '';
      return { title: selection ? `Школьные (Spotlight) · ${selection}` : 'Школьные (Spotlight)', icon: '📘', available: true };
    }

    if (kidsMode) {
      const meta = getKidsDictionaryMeta(settings.activePremiumDictionaryId);
      return meta
        ? { title: meta.title, icon: meta.icon, available: true }
        : { title: 'Выбранный словарь недоступен', icon: '⚠️', available: false };
    }

    const meta = getPremiumDictionaryCatalog().find(item => item.id === settings.activePremiumDictionaryId);
    return meta
      ? { title: meta.title, icon: meta.icon, available: true }
      : { title: 'Выбранный словарь недоступен', icon: '⚠️', available: false };
  }

  if (assignedCount) return { title: 'Слова от преподавателя', icon: '🎓', available: true };
  if (kidsMode) return { title: settings.difficulty === 'ALL' ? 'Все уровни' : settings.difficulty, icon: '🌈', available: true };
  return { title: 'General English', icon: '📚', available: true };
};
