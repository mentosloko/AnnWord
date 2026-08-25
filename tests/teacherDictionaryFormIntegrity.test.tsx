import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/masterDictionaryLookup', () => ({
  resolveDictionaryWordTranslations: vi.fn(async (words: string[]) => ({ translations: Object.fromEntries(words.map(word => [word, 'перевод'])), readyWords: words, canonicalWords: words, manualWords: [], missingWords: [] })),
}));

import { DictionaryStudioScreen } from '../components/screens/DictionaryStudioScreen';
import { GUEST_PROFILE } from '../constants/profileDefaults';

const teacherProfile = {
  ...GUEST_PROFILE,
  username: 'teacher@example.ru',
  role: 'teacher' as const,
  accountMode: 'teacher' as const,
  dictionaryCollections: [],
};

describe('teacher dictionary form integrity', () => {
  afterEach(cleanup);

  it('requires a non-empty word list and exposes a field-level error through ARIA', async () => {
    render(<DictionaryStudioScreen userProfile={teacherProfile} onBack={vi.fn()} onSaveDictionary={vi.fn()} />);
    const textarea = screen.getByLabelText('Список слов');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert', { name: '' })).toHaveTextContent('Добавьте хотя бы одно корректное английское слово.');
    expect(screen.getByRole('button', { name: 'Сохранить словарь преподавателя' })).toBeDisabled();

    fireEvent.change(textarea, { target: { value: 'PANDA\nTIGER\nZEBRA' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить словарь преподавателя' })).toBeEnabled());
  });

  it('requires an explicit teacher dictionary title and links the error to the input', async () => {
    render(<DictionaryStudioScreen userProfile={teacherProfile} onBack={vi.fn()} onSaveDictionary={vi.fn()} />);
    const textarea = screen.getByLabelText('Список слов');
    fireEvent.change(textarea, { target: { value: 'PANDA\nTIGER\nZEBRA' } });
    const title = screen.getByLabelText('Название словаря');
    fireEvent.change(title, { target: { value: '' } });
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title.getAttribute('aria-describedby')).toBe('teacher-dictionary-title-error');
    expect(screen.getByText('Введите название словаря.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить словарь преподавателя' })).toBeDisabled());
  });
});
