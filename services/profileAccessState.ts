import { UserProfile } from '../types';

const latestWorld = (previous: UserProfile, next: UserProfile) => {
  const previousAt = previous.pet.activeWorldDate ? Date.parse(previous.pet.activeWorldDate) : Number.NaN;
  const nextAt = next.pet.activeWorldDate ? Date.parse(next.pet.activeWorldDate) : Number.NaN;
  const preservePrevious = Boolean(previous.pet.activeWorldDate)
    && (!next.pet.activeWorldDate || (!Number.isNaN(previousAt) && !Number.isNaN(nextAt) && previousAt > nextAt));
  return preservePrevious
    ? { activeWorldId: previous.pet.activeWorldId, activeWorldDate: previous.pet.activeWorldDate }
    : { activeWorldId: next.pet.activeWorldId, activeWorldDate: next.pet.activeWorldDate };
};

/**
 * Network responses can arrive out of order. Keep irreversible onboarding and
 * append-only rewards monotonic while still allowing normal mutable fields
 * such as coins, mood and inventory to follow the newest server response.
 */
export const preserveEstablishedAccountAccess = (previous: UserProfile, next: UserProfile): UserProfile => {
  const preserveAccess = Boolean(previous.accountMode && !next.accountMode);
  const world = latestWorld(previous, next);
  return {
    ...next,
    ...(preserveAccess ? {
      role: previous.role,
      accountMode: previous.accountMode,
      subscriptionTier: previous.subscriptionTier,
      premiumExpiresAt: previous.premiumExpiresAt,
      kidsTrialStartedAt: previous.kidsTrialStartedAt,
      kidsTrialExpiresAt: previous.kidsTrialExpiresAt,
      childDisplayName: previous.childDisplayName,
      childShareCode: previous.childShareCode,
      childSlotsLimit: previous.childSlotsLimit,
      featureFlags: previous.featureFlags,
      dictionaryCollections: previous.dictionaryCollections,
      weeklyReportEmail: previous.weeklyReportEmail,
    } : {}),
    pet: {
      ...next.pet,
      characterOnboarded: previous.pet.characterOnboarded === true || next.pet.characterOnboarded === true,
      earnedStickerIds: Array.from(new Set([...(previous.pet.earnedStickerIds || []), ...(next.pet.earnedStickerIds || [])])),
      ...world,
    },
  };
};
