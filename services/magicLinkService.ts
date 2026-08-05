import { backendApiRequest } from './backendApiClient';

interface MagicLinkResponse {
  ok: boolean;
  message?: string;
  accountMode?: 'player' | 'parent' | 'teacher' | null;
}

export interface MagicLinkConfirmation { message: string; accountMode?: 'player' | 'parent' | 'teacher' | null; }

export const magicLinkService = {
  async request(email: string): Promise<string> {
    const result = await backendApiRequest<MagicLinkResponse>('/api/auth/magic-link/request', {
      method: 'POST',
      body: { email },
    });
    return result.message || 'Если аккаунт существует, письмо со ссылкой для входа отправлено.';
  },

  async confirm(token: string): Promise<MagicLinkConfirmation> {
    const result = await backendApiRequest<MagicLinkResponse>('/api/auth/magic-link/confirm', {
      method: 'POST',
      body: { token },
    });
    return { message: result.message || 'Email подтверждён. Вход выполнен.', accountMode: result.accountMode };
  },
};
