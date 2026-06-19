const env = (name: string, fallback = '') => process.env[name] || fallback;

export const publicCallbackUrl = (): string =>
  env('PRODAMUS_NOTIFICATION_APP_URL', env('PRODAMUS_PUBLIC_APP_URL', 'https://ann-word.vercel.app')).replace(/\/+$/, '');
