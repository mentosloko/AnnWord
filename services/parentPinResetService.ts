import { backendApiRequest } from './backendApiClient';

interface ParentPinResetResponse {
  ok: boolean;
  message?: string;
}

interface ParentPinResetStatusResponse {
  valid: boolean;
  code?: string;
  error?: string;
}

export const parentPinResetService = {
  async request(): Promise<string> {
    const result = await backendApiRequest<ParentPinResetResponse>('/api/family/pin/reset/request', {
      method: 'POST',
    });
    return result.message || 'Письмо для восстановления PIN отправлено на email аккаунта.';
  },

  async validate(token: string): Promise<ParentPinResetStatusResponse> {
    return backendApiRequest<ParentPinResetStatusResponse>('/api/family/pin/reset/status', {
      method: 'POST',
      body: { token },
    });
  },

  async confirm(token: string, pin: string): Promise<string> {
    const result = await backendApiRequest<ParentPinResetResponse>('/api/family/pin/reset/confirm', {
      method: 'POST',
      body: { token, accessCode: pin },
    });
    return result.message || 'Родительский PIN обновлён.';
  },
};
