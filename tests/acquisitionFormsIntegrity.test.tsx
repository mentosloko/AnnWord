import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHeader } from '../components/layout/AppHeader';
import { AuthModal } from '../components/auth/AuthModal';
import { FamilySetupScreen } from '../components/screens/FamilySetupScreen';
import { GUEST_PROFILE } from '../constants/profileDefaults';
import { isValidTeacherConnectionCode, normalizeTeacherConnectionCode } from '../services/mentorRoomService';

const AuthHarness = ({ mode = 'register', loading = false }: { mode?: 'login' | 'register'; loading?: boolean }) => {
  const [email, setEmail] = useState(mode === 'login' ? 'parent@example.ru' : '');
  const [password, setPassword] = useState(mode === 'login' ? 'password123' : '');
  return <AuthModal isOpen mode={mode} email={email} password={password} error={null} isLoading={loading} onClose={vi.fn()} onModeChange={vi.fn()} onEmailChange={setEmail} onPasswordChange={setPassword} onSubmit={vi.fn()} onYandexLogin={vi.fn()} />;
};

describe('acquisition and forms integrity', () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
  });

  it('guest parent header keeps both login and registration actions available and routes CTA through callback', () => {
    window.history.replaceState({}, '', '/kids');
    const login = vi.fn();
    const register = vi.fn();
    render(<AppHeader route="landing" userProfile={GUEST_PROFILE} isAuthenticated={false} onHomeClick={vi.fn()} onLoginClick={login} onRegisterClick={register} onLogoutClick={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    fireEvent.click(screen.getByRole('button', { name: 'Начать бесплатно' }));
    expect(login).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('registration CTA remains disabled until required fields and consents are valid', () => {
    render(<AuthHarness />);
    const submit = screen.getByRole('button', { name: 'Создать аккаунт' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Электронная почта'), { target: { value: 'parent@example.ru' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password123' } });
    expect(submit).toBeDisabled();

    const requiredChecks = screen.getAllByRole('checkbox').slice(0, 2);
    fireEvent.click(requiredChecks[0]);
    fireEvent.click(requiredChecks[1]);
    expect(submit).toBeEnabled();
  });

  it('shows explicit pending login copy and blocks duplicate submit', () => {
    render(<AuthHarness mode="login" loading />);
    const submit = screen.getByRole('button', { name: 'Входим…' });
    expect(submit).toBeDisabled();
  });

  it('parent setup CTA stays inactive until name, exact 4-digit PIN pair and consent are valid', () => {
    render(<FamilySetupScreen onCreateChild={vi.fn()} onComplete={vi.fn()} onBackHome={vi.fn()} />);
    const submit = screen.getByRole('button', { name: 'Продолжить к питомцу' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Имя ребёнка'), { target: { value: 'Аня' } });
    const pinInputs = screen.getAllByPlaceholderText('4 цифры');
    fireEvent.change(pinInputs[0], { target: { value: '123' } });
    fireEvent.change(pinInputs[1], { target: { value: '123' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(submit).toBeDisabled();
    fireEvent.change(pinInputs[0], { target: { value: '1234' } });
    fireEvent.change(pinInputs[1], { target: { value: '1234' } });
    expect(submit).toBeEnabled();
  });

  it('teacher connection code accepts only six uppercase alphanumeric characters after normalization', () => {
    expect(normalizeTeacherConnectionCode(' ab12cd ')).toBe('AB12CD');
    expect(isValidTeacherConnectionCode('ab12cd')).toBe(true);
    expect(isValidTeacherConnectionCode('ABC12')).toBe(false);
    expect(isValidTeacherConnectionCode('ABC-12')).toBe(false);
  });
});
