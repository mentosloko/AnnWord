import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('P0 first-session activation contracts', () => {
  it('makes the parent account model explicit before and during child setup', () => {
    expect(read('components/screens/LandingMixScreen.tsx')).toContain('Аккаунт создаёт родитель · ребёнку отдельная почта не нужна');
    expect(read('components/screens/FamilySetupScreen.tsx')).toContain('Вы вошли в аккаунт родителя. Ребёнку отдельная почта не нужна');
  });
  it('keeps the Classic hint short and constrained to a narrow mobile viewport', () => {
    const controller = read('hooks/useClassicGameController.ts');
    const screen = read('components/screens/ClassicGameScreen.tsx');
    expect(controller).toContain('Проверь новые буквы: ${word}${coinText}');
    expect(controller).toContain("' · −1★'");
    expect(screen).toContain('w-[min(20rem,calc(100vw-1rem))]');
    expect(screen).toContain('break-words');
  });
  it('grants one starter apple when character onboarding completes', () => {
    const repository = read('server/authoritativeGameResultRepository.ts');
    expect(repository).toContain('inventory = case');
    expect(repository).toContain('Энерго-яблоко');
    expect(repository).toContain('[userId, JSON.stringify(next), completingOnboarding]');
    expect(read('AppV2.tsx')).toContain("replaceRoute('pet_room'); }, [currentUserId, isCurrentProfileOwner, profileEconomy, replaceRoute]);");
  });
  it('offers a direct play CTA when food is unaffordable', () => {
    const shop = read('components/Shop.tsx');
    const room = read('components/PetRoom.tsx');
    const screens = read('components/AppScreens.tsx');
    expect(shop).toContain('Монет пока не хватает. Сыграй и заработай.');
    expect(room).toContain('Сыграть и заработать');
    expect(room).toContain('сыграй и заработай');
    expect(screens).toContain("onPlay={() => onRouteChange('setup')}");
  });
});
