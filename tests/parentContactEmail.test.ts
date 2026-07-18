import { describe, expect, it } from 'vitest';
import { normalizeParentContactEmail } from '../server/parentContactRepository';

describe('parent contact email', () => {
  it('normalizes a valid address', () => {
    expect(normalizeParentContactEmail('  Parent@Example.RU ')).toBe('parent@example.ru');
  });

  it('allows clearing the contact address', () => {
    expect(normalizeParentContactEmail('')).toBeNull();
    expect(normalizeParentContactEmail(undefined)).toBeNull();
  });

  it('rejects malformed addresses', () => {
    expect(() => normalizeParentContactEmail('parent-at-example.ru')).toThrow('Введите корректный email родителя.');
    expect(() => normalizeParentContactEmail(`${'a'.repeat(245)}@example.ru`)).toThrow('Введите корректный email родителя.');
  });
});
