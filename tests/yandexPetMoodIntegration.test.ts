import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Yandex pet mood integration', () => {
  it('reconciles mood on profile reads and inside the optimized game-result transaction', () => {
    const routes = read('server/routes/profileRoutes.ts');
    const repository = read('server/petMoodRepository.ts');
    expect(routes).toContain('const profile = await reconcileProfileMood(user.id);');
    expect(routes).toContain('applyGameResultAndReconcileProfile');
    expect(repository).toContain('export const applyGameResultAndReconcileProfile');
    expect(repository).toContain('const nextPet = reconcilePet(mergedPet, serverNowMs(row), true);');
    expect(repository).toContain('markServerPetActivity(clock.pet, today, previousMoscowDateKey(nowMs))');
  });

  it('uses a server-authoritative item endpoint in Yandex production', () => {
    const api = read('services/profileApiService.ts');
    const service = read('services/userService.ts');
    const routes = read('server/routes/profileRoutes.ts');
    expect(api).toContain('/api/profile/use-item');
    expect(service).toContain('profileApiService.useItem(itemId, events)');
    expect(service).not.toContain("from '../supabase'");
    expect(routes).toContain('useProfileItemServerAuthoritative');
  });

  it('does not trust a whole-profile sync to increase mood without server-observed food consumption', () => {
    const repository = read('server/petMoodRepository.ts');
    expect(repository).toContain('moodScore: serverPet.moodScore');
    expect(repository).toContain('consumedFoodId(currentInventory, requestedInventory)');
    expect(repository).toContain('applyServerMoodIncrease(pet, food.moodEffect || 8, nowMs)');
  });

  it('keeps earned stickers server-authoritative and persistent', () => {
    const repository = read('server/petMoodRepository.ts');
    const policy = read('services/serverPetMoodPolicy.ts');
    const catalog = read('services/premiumFeatureCatalog.ts');
    expect(repository).toContain('earnedStickerIds: Array.from(new Set([...(serverPet.earnedStickerIds || []), ...(incomingPet.earnedStickerIds || [])]))');
    expect(repository).toContain('!sameStringSet(nextPet.earnedStickerIds, clock.pet.earnedStickerIds)');
    expect(policy).toContain('preserveEarnedStickerIds(pet.earnedStickerIds, streakDays)');
    expect(catalog).toContain("streak_1: { title: 'Первый шаг'");
  });

  it('backfills current streak rewards and grants anna.a.manto the 1-day and 3-day stickers in Yandex PostgreSQL', () => {
    const migration = read('db/yandex/20260727_persist_streak_stickers.sql');
    expect(migration).toContain("lower(trim(coalesce(p.username, ''))) = 'anna.a.manto'");
    expect(migration).toContain("union all select 'streak_1'");
    expect(migration).toContain("union all select 'streak_3'");
    expect(migration).toContain("jsonb_set(desired_stickers.pet_obj, '{earnedStickerIds}'");
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
