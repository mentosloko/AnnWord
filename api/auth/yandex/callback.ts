const getAppUrlFromState = (state?: string | string[]) => {
  if (!state || Array.isArray(state)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    if (typeof parsed.appUrl === 'string') return parsed.appUrl.replace(/\/$/, '');
  } catch (_) {
    return null;
  }

  return null;
};

const getFallbackAppUrl = (req: any) => {
  const configuredUrl = process.env.APP_URL || process.env.VITE_APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
};

export default async function handler(req: any, res: any) {
  const appUrl = getAppUrlFromState(req.query.state) || getFallbackAppUrl(req);
  const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;

  if (!code) {
    return res.redirect(`${appUrl}/?auth_error=yandex_no_code`);
  }

  return res.redirect(`${appUrl}/?auth_error=yandex_callback_not_configured`);
}
