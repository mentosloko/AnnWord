export const PET_FEEDING_ITEM_STORAGE_KEY = 'annword_pet_feeding_item';

export const rememberPurchasedTreatForFeeding = (itemId: string): void => {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(PET_FEEDING_ITEM_STORAGE_KEY, itemId); } catch { /* Feeding still works without storage. */ }
};

export const takePurchasedTreatForFeeding = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const itemId = window.sessionStorage.getItem(PET_FEEDING_ITEM_STORAGE_KEY);
    window.sessionStorage.removeItem(PET_FEEDING_ITEM_STORAGE_KEY);
    return itemId;
  } catch {
    return null;
  }
};
