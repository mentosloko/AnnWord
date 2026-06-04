import { UserProfile } from '../types';

/**
 * Some gameplay RPCs return only gameplay fields. Once the account mode has
 * been selected, a partial response must never erase onboarding or adult
 * access state in the client cache.
 */
export const preserveEstablishedAccountAccess = (previous: UserProfile, next: UserProfile): UserProfile => {
  if (!previous.accountMode || next.accountMode) return next;

  return {
    ...next,
    role: previous.role,
    accountMode: previous.accountMode,
    subscriptionTier: previous.subscriptionTier,
    premiumExpiresAt: previous.premiumExpiresAt,
    childDisplayName: previous.childDisplayName,
    childShareCode: previous.childShareCode,
    childSlotsLimit: previous.childSlotsLimit,
    featureFlags: previous.featureFlags,
    dictionaryCollections: previous.dictionaryCollections,
    weeklyReportEmail: previous.weeklyReportEmail,
  };
};
