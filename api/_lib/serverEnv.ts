export const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

export const optional = (name: string, fallback = ''): string => process.env[name] || fallback;

export const appOrigin = (): string => optional('PRODAMUS_APP_URL', optional('APP_URL', 'https://ann-word.vercel.app')).replace(/\/+$/, '');

export const payformOrigin = (): string => {
  const raw = optional('PRODAMUS_PAYFORM_HOST', 'manto-school.payform.ru').trim();
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return url.replace(/\/+$/, '');
};
