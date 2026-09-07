import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractClientRewardClaim, sanitizeGameRewardInput } from '../server/authoritativeGameResultRepository';

const read = (relativePath: string): string => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('game economy security', () => {
  it('accepts the real reward event key format including ISO timestamp dots', () => {
    const claim = extractClientRewardClaim([
      {
        eventType: 'reward_granted',
        eventKey: 'reward:11111111-1111-1111-1111-111111111111:sprint:2026-09-07T12:34:56.789Z:abc-123',
        payload: { input: { type: 'sprint', guessedWords: 10 } },
      },
    ]);
    expect(claim).toEqual({
      eventKey: 'reward:11111111-1111-1111-1111-111111111111:sprint:2026-09-07T12:34:56.789Z:abc-123',
      input: { type: 'sprint', guessedWords: 10 },
    });
  });

  it('rejects direct client reward inflation and impossible result ranges', () => {
    expect(() => sanitizeGameRewardInput({ type: 'sprint', guessedWords: 10, coinsAdjustment: 5000 })).toThrow();
    expect(() => sanitizeGameRewardInput({ type: 'sprint', guessedWords: 61 })).toThrow();
    expect(() => sanitizeGameRewardInput({ type: 'translation', guessedWords: 11 })).toThrow();
    expect(() => sanitizeGameRewardInput({ type: 'letterSquare', guessedWords: 9 })).toThrow();
    expect(() => sanitizeGameRewardInput({ type: 'memory', moves: 0 })).toThrow();
    expect(() => sanitizeGameRewardInput({ type: 'hangman', mistakes: 15, maxMistakes: 7 })).toThrow();
    expect(() => sanitizeGameRewardInput({ type: 'wordle', won: true })).toThrow();
    expect(() => sanitizeGameRewardInput({ type: 'other' })).toThrow();
  });

  it('removes client coin adjustment from per-word anagram rewards', () => {
    expect(sanitizeGameRewardInput({ type: 'anagram', guessedWords: 1, coinsAdjustment: 999 })).toEqual({
      type: 'anagram',
      guessedWords: 1,
      statsOnly: false,
      wonForStats: undefined,
      coinsAdjustment: 0,
    });
  });

  it('mounts security interception before legacy profile mutation handlers', () => {
    const assigned = read('server/routes/assignedWordsRoutes.ts');
    const profile = read('server/routes/profileRoutes.ts');
    expect(assigned).toContain('assignedWordsRouter.use(profileSecurityRouter)');
    expect(profile.indexOf('profileRouter.use(assignedWordsRouter)')).toBeLessThan(profile.indexOf('profileRouter.post("/coins"'));
    expect(profile.indexOf('profileRouter.use(assignedWordsRouter)')).toBeLessThan(profile.indexOf('profileRouter.post("/game-result"'));
  });

  it('blocks raw positive coin credits and protects server progression fields', () => {
    const securityRoutes = read('server/routes/profileSecurityRoutes.ts');
    const authoritative = read('server/authoritativeGameResultRepository.ts');
    expect(securityRoutes).toContain("code: 'direct_coin_credit_forbidden'");
    expect(securityRoutes).toContain("profileSecurityRouter.patch('/pet'");
    expect(securityRoutes).toContain("profileSecurityRouter.patch('/stats'");
    expect(securityRoutes).toContain("profileSecurityRouter.post('/sync-state'");
    expect(authoritative).toContain('gamesPlayed: current.gamesPlayed');
    expect(authoritative).toContain('gamesWon: current.gamesWon');
    expect(authoritative).toContain('characterOnboarded: current.characterOnboarded === true || completingOnboarding');
  });

  it('caps reward farming and only lets recent authoritative results feed Kids daily quests', () => {
    const authoritative = read('server/authoritativeGameResultRepository.ts');
    const daily = read('server/routes/dailyQuestRoutes.ts');
    expect(authoritative).toContain('DAILY_MAX_XP = 2500');
    expect(authoritative).toContain('DAILY_MAX_COINS = 150');
    expect(authoritative).toContain('MAX_ANAGRAM_REWARDS_PER_MINUTE = 40');
    expect(authoritative).toContain('MAX_SESSION_REWARDS_PER_MINUTE = 12');
    expect(authoritative).toContain("occurred_at >= now() - interval '30 minutes'");
    expect(daily).toContain('getLatestAuthoritativeQuestSource');
    expect(daily).toContain('claimDailyQuestSource');
  });

  it('zeroes client-provided economy deltas in the telemetry endpoint', () => {
    const gameEvents = read('server/routes/gameEventRoutes.ts');
    expect(gameEvents).toContain('coinsDelta: 0');
    expect(gameEvents).toContain('xpDelta: 0');
    expect(gameEvents).toContain("!key.startsWith('authoritative:')");
    expect(gameEvents).toContain("!key.startsWith('daily-quest:')");
  });
});
