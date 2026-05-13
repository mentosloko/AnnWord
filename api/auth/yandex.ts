const getAppUrl = (req: any) => {
  const configuredUrl = process.env.APP_URL || process.env.VITE_APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
};

export default function handler(req: any, res: any) {
  const appUrl = getAppUrl(req);
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!supabaseUrl) {
    return res.redirect(`${appUrl}/?auth_error=supabase_url_missing`);
  }

  const params = new URLSearchParams({
    provider: 'yandex',
    redirect_to: appUrl
  });

  return res.redirect(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/authorize?${params.toString()}`);
}
