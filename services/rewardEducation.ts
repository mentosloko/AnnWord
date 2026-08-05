export type RewardEducationKind = 'coins' | 'xp' | 'coins_and_xp';
const PREFIX = 'annword_reward_education_v1:';

export const readRewardEducation = (userId: string | null, kind: 'coins' | 'xp'): boolean => {
  if (!userId || typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(`${PREFIX}${userId}:${kind}`) === '1'; } catch { return false; }
};

export const markRewardEducation = (userId: string | null, kind: RewardEducationKind): void => {
  if (!userId || typeof window === 'undefined') return;
  try {
    if (kind === 'coins' || kind === 'coins_and_xp') window.localStorage.setItem(`${PREFIX}${userId}:coins`, '1');
    if (kind === 'xp' || kind === 'coins_and_xp') window.localStorage.setItem(`${PREFIX}${userId}:xp`, '1');
  } catch { /* optional tutorial state */ }
};
