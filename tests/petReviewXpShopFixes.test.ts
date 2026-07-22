import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('pet, review words, XP and shop refinements', () => {
  it('does not ask a happy pet for a treat', () => {
    const room = read('components/PetRoom.tsx');
    expect(room).toContain('isHappyEnough(profile)');
    expect(room).toContain('JOY_PHRASES');
    expect(room).toContain("flags.treatRequests && !isHappyEnough(profile)");
    expect(room).toContain('Спасибо за заботу! Я очень доволен.');
  });

  it('opens translations from review-word chips', () => {
    const profile = read('components/screens/ProfileScreen.tsx');
    const parent = read('components/screens/ParentDashboardScreen.tsx');
    const list = read('components/ReviewWordList.tsx');
    expect(profile).toContain('<ReviewWordList');
    expect(parent).toContain('<ReviewWordList');
    expect(list).toContain('aria-haspopup="dialog"');
    expect(list).toContain('wordTranslationService.get(word)');
  });

  it('uses Progress consistently in navigation', () => {
    const header = read('components/layout/AppHeader.tsx');
    expect(header).not.toContain("label: 'Статистика'");
    expect(header).not.toContain(" : 'Статистика'");
    expect(header).toContain("label: 'Прогресс'");
  });

  it('shows the same character XP model on home and in the pet room', () => {
    const rules = read('services/gamificationRules.ts');
    const home = read('components/screens/KidsHomeScreen.tsx');
    const room = read('components/PetRoom.tsx');
    expect(rules).toContain('getCharacterXpProgress');
    expect(home).toContain('getCharacterXpProgress(userProfile.pet)');
    expect(room).toContain('getCharacterXpProgress(pet)');
    expect(home).toContain('xp.currentLevelXp}/{xp.xpForNextLevel');
    expect(room).toContain('xp.currentLevelXp}/{xp.xpForNextLevel');
  });

  it('removes nearest-goal text blocks from the shop', () => {
    const shop = read('components/Shop.tsx');
    expect(shop).not.toContain('Ближайшая цель');
    expect(shop).not.toContain('firstTarget');
    expect(shop).not.toContain('coinsNeededForFirst');
  });
});
