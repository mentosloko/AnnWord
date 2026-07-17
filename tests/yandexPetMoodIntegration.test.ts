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

  it('uses moodUpdatedAt as the decay anchor and keeps streak activity separate', () => {
    const types = read('types.ts');
    const policy = read('services/serverPetMoodPolicy.ts');
    const decayStart = policy.indexOf('export const applyServerPetMoodClock');
    const activityStart = policy.indexOf('export const markServerPetActivity');
    const decayBody = policy.slice(decayStart, activityStart);
    expect(types).toContain('moodUpdatedAt?: string');
    expect(decayBody).toContain('const anchorMs = validTimestamp(pet.moodUpdatedAt)');
    expect(decayBody).not.toContain('lastDailyActivityDate');
    expect(policy.slice(activityStart)).toContain('lastDailyActivityDate');
  });

  it('does not leave the temporary production diagnostic endpoint in the application', () => {
    const routes = read('server/routes/profileRoutes.ts');
    expect(routes).not.toContain('internal-diagnostic');
    expect(routes).not.toContain('x-annword-diagnostic-secret');
    expect(routes).not.toContain('createHmac');
  });
});
