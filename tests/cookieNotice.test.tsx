import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CookieNotice } from '../components/layout/CookieNotice';
import { LEGAL_DOCUMENTS } from '../services/legalDocuments';

const storageKey = 'annword:cookie-notice:v1';

describe('CookieNotice', () => {
  beforeEach(() => {
    window.localStorage.removeItem(storageKey);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.removeItem(storageKey);
  });

  it('shows a compact informational notice with a cookie policy link on first visit', () => {
    render(<CookieNotice />);

    expect(screen.getByRole('region', { name: 'Уведомление об использовании cookie' })).toBeInTheDocument();
    expect(screen.getByText(/Яндекс Метрику для аналитики/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Подробнее' })).toHaveAttribute('href', LEGAL_DOCUMENTS.cookiePolicy);
  });

  it('remembers acknowledgement without changing analytics settings', () => {
    const { unmount } = render(<CookieNotice />);

    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    expect(screen.queryByRole('region', { name: 'Уведомление об использовании cookie' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(storageKey)).toBe('acknowledged');

    unmount();
    render(<CookieNotice />);
    expect(screen.queryByRole('region', { name: 'Уведомление об использовании cookie' })).not.toBeInTheDocument();
  });
});
