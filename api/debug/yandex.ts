export default function handler(req: any, res: any) {
  const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || `https://${req.headers.host}`;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';

  const params = new URLSearchParams({
    provider: 'yandex',
    redirect_to: appUrl.replace(/\/$/, '')
  });

  res.status(200).json({
    ok: true,
    host: req.headers.host,
    appUrl: appUrl.replace(/\/$/, ''),
    hasSupabaseUrl: Boolean(supabaseUrl),
    supabaseUrlHost: supabaseUrl ? new URL(supabaseUrl).host : null,
    authorizeUrl: supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/auth/v1/authorize?${params.toString()}` : null,
    hasYandexClientId: Boolean(process.env.YANDEX_CLIENT_ID),
    hasYandexClientSecret: Boolean(process.env.YANDEX_CLIENT_SECRET),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
