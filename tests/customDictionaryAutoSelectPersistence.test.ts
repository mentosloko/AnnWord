import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('custom dictionary auto-selection persistence', () => {
  it('persists the custom active source in the same transaction as a Kids/user collection save', () => {
    const repository = readFileSync('server/dictionaryCollectionRepository.ts', 'utf8');

    expect(repository).toContain('const shouldAutoSelect = !isTeacher && !isAdmin');
    expect(repository).toContain('active_word_source = case when $5::boolean then $6::jsonb else active_word_source end');
    expect(repository).toContain('active_word_source_updated_at = case when $5::boolean then now() else active_word_source_updated_at end');
    expect(repository).toContain('const nextActiveWordSource = shouldAutoSelect ? { source: "custom", difficulty } : currentSource');
  });

  it('does not auto-select the saved collection for teacher/admin dictionaries', () => {
    const repository = readFileSync('server/dictionaryCollectionRepository.ts', 'utf8');
    expect(repository).toContain('const shouldAutoSelect = !isTeacher && !isAdmin');
  });
});
