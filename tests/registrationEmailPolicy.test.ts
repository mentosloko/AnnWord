import { describe, expect, it } from 'vitest';
import { isRussianRegistrationEmail } from '../server/emailPolicy';

describe('Russian registration email policy', () => {
  it.each([
    'user@yandex.ru',
    'user@mail.ru',
    'user@пример.рф',
    'user@xn--e1afmkfd.xn--p1ai',
  ])('allows %s', (email) => {
    expect(isRussianRegistrationEmail(email)).toBe(true);
  });

  it.each([
    'steamexquisite@gmail.com',
    'user@outlook.com',
    'user@example.org',
  ])('rejects %s', (email) => {
    expect(isRussianRegistrationEmail(email)).toBe(false);
  });
});
