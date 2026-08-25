import { backendApiRequest } from './backendApiClient';

interface PasswordResetResponse {
  ok: boolean;
  message?: string;
}

interface PasswordResetStatusResponse {
  valid: boolean;
  code?: string;
  error?: string;
}

export const passwordResetService = {
  async request(email: string): Promise<string> {
    const result = await backendApiRequest<PasswordResetResponse>('/api/auth/password/reset/request', {
      method: 'POST',
      body: { email },
    });
    return result.message || 'Если аккаунт существует, письмо для восстановления отправлено.';
  },

  async validate(token: string): Promise<PasswordResetStatusResponse> {
    return backendApiRequest<PasswordResetStatusResponse>('/api/auth/password/reset/status', {
      method: 'POST',
      body: { token },
    });
  },

  async confirm(token: string, password: string): Promise<string> {
    const result = await backendApiRequest<PasswordResetResponse>('/api/auth/password/reset/confirm', {
      method: 'POST',
      body: { token, credential: password },
    });
    return result.message || 'Пароль обновлён.';
  },
};
