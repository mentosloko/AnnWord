import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { AuthModal } from '../components/auth/AuthModal';
import { ScreenContainer } from '../components/layout/ScreenContainer';

const read = (path: string) => readFileSync(path, 'utf8');

const authProps = {
  mode: 'login' as const,
  email: '',
  password: '',
  error: null,
  isLoading: false,
  onClose: vi.fn(),
  onModeChange: vi.fn(),
  onEmailChange: vi.fn(),
  onPasswordChange: vi.fn(),
  onSubmit: vi.fn(),
  onYandexLogin: vi.fn(),
};

describe('accessibility regression contracts', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('keeps exactly one main landmark when a screen already supplies its own main', () => {
    const { rerender } = render(<ScreenContainer><section>Обычный экран</section></ScreenContainer>);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');

    rerender(<ScreenContainer><section><main>Внутренний контент</main></section></ScreenContainer>);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveTextContent('Внутренний контент');
  });

  it('labels the teacher dictionary assignment select when the legacy screen does not', async () => {
    render(<ScreenContainer><select defaultValue=""><option value="">Выберите подборку</option><option value="one">Unit 1</option></select></ScreenContainer>);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveAccessibleName('Словарь для назначения ученику'));
  });

  it('restores focus to the auth opener after close and keeps errors inside the dialog', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'Войти';
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = render(<AuthModal {...authProps} isOpen />);
    const dialog = screen.getByRole('dialog', { name: 'Войти в AnnWord' });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    rerender(<AuthModal {...authProps} isOpen error="Неверный пароль" />);
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    rerender(<AuthModal {...authProps} isOpen={false} />);
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('ships a visible-on-focus skip link and one stable content target', () => {
    const shell = read('components/AppShell.tsx');
    const container = read('components/layout/ScreenContainer.tsx');
    expect(shell).toContain('href="#main-content"');
    expect(shell).toContain('Перейти к содержанию');
    expect(shell).toContain('focus:translate-y-0');
    expect(container).toContain("id = 'main-content'");
  });

  it('implements WAI-ARIA tab relationships and keyboard navigation in Shop', () => {
    const shop = read('components/Shop.tsx');
    expect(shop).toContain('role="tablist"');
    expect(shop).toContain('role="tab"');
    expect(shop).toContain('aria-controls={`shop-panel-${tab}`}');
    expect(shop).toContain('aria-labelledby={`shop-tab-${activeTab}`}');
    expect(shop).toContain('tabIndex={activeTab === tab ? 0 : -1}');
    expect(shop).toContain("event.key === 'ArrowRight'");
    expect(shop).toContain("event.key === 'ArrowLeft'");
    expect(shop).toContain("event.key === 'Home'");
    expect(shop).toContain("event.key === 'End'");
    expect(shop).toContain('<main id="main-content"');
    expect(shop).toContain('<h1');
  });

  it('guards contrast for secondary text on light app surfaces', () => {
    const css = read('index.css');
    expect(css).toContain('#main-content .bg-white .text-gray-500');
    expect(css).toContain('color: #374151');
    expect(css).toContain('#main-content .bg-white .text-indigo-400');
    expect(css).toContain('color: #4338ca');
  });
});
