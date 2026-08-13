import type { PetState, ShopItem, UserProfile, UserStats } from '../types';
import type { QueuedAnalyticsEvent } from './analyticsService';
import type { GameLedgerEvent } from './gameEventLedgerService';
import { consumePendingRegisteredProfile } from './authService';
import { profileApiService } from './profileApiService';

const normalizeEmail = (email: string): string | null => {
  const value = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
};

export const userService = {
  getOrCreateProfile: async (userId: string, _defaultUsername = 'Пользователь', _email?: string): Promise<UserProfile> => {
    const registeredProfile = consumePendingRegisteredProfile(userId);
    return registeredProfile || profileApiService.getCurrentProfile();
  },

  applyGameResult: async (
    _userId: string,
    stats: UserStats,
    pet: PetState,
    coinsDelta: number,
    events: QueuedAnalyticsEvent[] = [],
    gameEvents: GameLedgerEvent[] = [],
  ): Promise<UserProfile> => profileApiService.applyGameResult(stats, pet, coinsDelta, events, gameEvents),

  syncProfileState: async (
    _userId: string,
    profile: Pick<UserProfile, 'inventory' | 'pet' | 'coins'>,
    _events: QueuedAnalyticsEvent[] = [],
  ): Promise<UserProfile> => profileApiService.syncProfileState(profile),

  updateCoins: async (_userId: string, amount: number): Promise<UserProfile> => profileApiService.incrementCoins(amount),

  buyCurrentUserItem: async (item: ShopItem): Promise<UserProfile> => {
    if (item.type === 'mystery' || item.id === 'mystery_box') {
      throw new Error('Секретная коробка доступна только за ежедневное задание.');
    }
    return profileApiService.purchaseItem(item.id);
  },

  buyItem: async (
    _userId: string,
    item: ShopItem,
    _optimistic?: UserProfile,
    events: QueuedAnalyticsEvent[] = [],
  ): Promise<UserProfile> => {
    if (item.type === 'mystery' || item.id === 'mystery_box') {
      throw new Error('Секретная коробка доступна только за ежедневное задание.');
    }
    return profileApiService.purchaseItem(item.id, events);
  },

  useItem: async (
    _userId: string,
    itemId: string,
    _optimistic?: UserProfile,
    events: QueuedAnalyticsEvent[] = [],
  ): Promise<UserProfile> => profileApiService.useItem(itemId, events),

  updateUserStats: async (_userId: string, stats: UserStats): Promise<UserProfile> => profileApiService.updateStats(stats),

  updateUserDictionary: async (_userId: string, dictionary: string[]): Promise<UserProfile> => profileApiService.updateUserDictionary(dictionary),

  updateWeeklyReportEmail: async (email: string): Promise<UserProfile> => {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error('Введите корректный email для отчёта.');
    return profileApiService.updateWeeklyReportEmail(normalized);
  },

  updateUserPet: async (_userId: string, pet: PetState): Promise<UserProfile> => profileApiService.updatePet(pet),
};
