import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Yandex pet mood integration', () => {
  it('reconciles mood on profile reads and after game writes', () => {
    const routes = read('server/routes/profileRoutes.ts');
    expect(routes).toContain('const profile = await reconcileProfileMood(user.id);');
    expect(routes).toContain('const profile = await reconcileProfileMood(req.user!.id, true);');
    expect(routes.indexOf('await applyGameResult')).toBeLessThan(routes.lastIndexOf('reconcileProfileMood(req.user!.id, true)'));
  });

  it('uses a server-authoritative item endpoint in Yandex production', () => {
    const api = read('services/profileApiService.ts');
    const service = read('services/userService.ts');
    const routes = read('server/routes/profileRoutes.ts');
    expect(api).toContain('/api/profile/use-item');
    expect(service).toContain('if(isBackendApiConfigured)return profileApiService.useItem(itemId)');
    expect(routes).toContain('useProfileItemServerAuthoritative');
  });

  it('does not trust a whole-profile sync to increase mood without server-observed food consumption', () => {
    const repository = read('server/petMoodRepository.ts');
    expect(repository).toContain('moodScore: serverPet.moodScore');
    expect(repository).toContain('consumedFoodId(currentInventory, requestedInventory)');
    expect(repository).toContain('applyServerMoodIncrease(pet, food.moodEffect || 8, nowMs)');
  });

  it('tracks a dedicated mood timestamp instead of using streak activity as a decay clock', () => {
    const types = read('types.ts');
    const policy = read('services/serverPetMoodPolicy.ts');
    expect(types).toContain('moodUpdatedAt?: string');
    expect(policy).toContain('pet.moodUpdatedAt');
    expect(policy).not.toContain('lastDailyActivityDate');
  });
});
