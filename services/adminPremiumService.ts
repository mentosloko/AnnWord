import { backendApiRequest } from './backendApiClient';

export interface AdminPremiumUser {
  id: string;
  email: string;
  username: string;
  role: string;
  accountMode: string | null;
  subscriptionTier: 'free' | 'premium';
  premiumExpiresAt: string | null;
  premiumActive: boolean;
}

interface LookupResponse {
  user: AdminPremiumUser;
}

export interface AdminPremiumGrantResult {
  ok: true;
  user: AdminPremiumUser;
  grantedDays: number;
  previousExpiresAt: string | null;
  premiumExpiresAt: string;
}

export const adminPremiumService = {
  async findUserByEmail(email: string): Promise<AdminPremiumUser> {
    const response = await backendApiRequest<LookupResponse>(`/api/admin/premium/user?email=${encodeURIComponent(email.trim())}`);
    return response.user;
  },

  grantPremium(userId: string, days: number, note?: string): Promise<AdminPremiumGrantResult> {
    return backendApiRequest<AdminPremiumGrantResult>('/api/admin/premium/grant', {
      method: 'POST',
      body: { userId, days, note: note?.trim() || undefined },
    });
  },
};
