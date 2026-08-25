import { describe, expect, it } from 'vitest';
import { getAnagramSessionScore } from '../components/AnagramGame';

describe('Anagram session score', () => {
  it('does not erase solved words after skips or two-error words', () => {
    expect(getAnagramSessionScore(3)).toBe(3);
  });

  it('normalizes invalid or negative values safely', () => {
    expect(getAnagramSessionScore(-2)).toBe(0);
    expect(getAnagramSessionScore(Number.NaN)).toBe(0);
  });
});
