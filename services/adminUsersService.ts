import { backendApiRequest } from './backendApiClient';

export interface AdminUserSummary {
  id: string;
  email: string;
  fullName: string | null;
  provider: 'email' | 'yandex';
  emailConfirmed: boolean;
  createdAt: string;
  username: string | null;
  role: string | null;
  accountMode: string | null;
  subscriptionTier: 'free' | 'premium';
  premiumExpiresAt: string | null;
  premiumActive: boolean;
  childDisplayName: string | null;
}

export interface AdminUsersPage {
  users: AdminUserSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search: string;
}

export const adminUsersService = {
  list(params: { search?: string; page?: number; pageSize?: number; signal?: AbortSignal } = {}): Promise<AdminUsersPage> {
    const query = new URLSearchParams();
    const search = params.search?.trim();
    if (search) query.set('q', search);
    query.set('page', String(params.page || 1));
    query.set('pageSize', String(params.pageSize || 50));
    return backendApiRequest<AdminUsersPage>(`/api/admin/users?${query.toString()}`, {
      signal: params.signal,
      dedupe: false,
    });
  },
};
