const getAppUrl = (req: any) => {
  const configuredUrl = process.env.APP_URL || process.env.VITE_APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
};

export default function handler(req: any, res: any) {
  const clientId = process.env.YANDEX_CLIENT_ID;
  const appUrl = getAppUrl(req);

  if (!clientId) {
    return res.redirect(`${appUrl}/?auth_error=yandex_client_id_missing`);
  }

  const redirectUri = `${appUrl}/api/auth/yandex/callback`;
  const state = Buffer.from(JSON.stringify({ appUrl })).toString('base64url');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    force_confirm: 'no',
    state
  });

  return res.redirect(`https://oauth.yandex.ru/authorize?${params.toString()}`);
}
