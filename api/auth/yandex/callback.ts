import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

const getFallbackAppUrl = (req: VercelRequest) => {
  const configuredUrl = process.env.APP_URL || process.env.VITE_APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
};

const redirectWithError = (res: VercelResponse, appUrl: string, error: string) => {
  return res.redirect(`${appUrl}/?auth_error=${encodeURIComponent(error)}`);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const appUrl = getAppUrlFromState(req.query.state) || getFallbackAppUrl(req);
  const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const yandexClientId = process.env.YANDEX_CLIENT_ID;
  const yandexClientSecret = process.env.YANDEX_CLIENT_SECRET;

  if (!code) return redirectWithError(res, appUrl, 'yandex_no_code');
  if (!supabaseUrl || !serviceRoleKey) return redirectWithError(res, appUrl, 'supabase_server_env_missing');
  if (!yandexClientId || !yandexClientSecret) return redirectWithError(res, appUrl, 'yandex_server_env_missing');

  const redirectUri = `${appUrl}/api/auth/yandex/callback`;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  try {
    const tokenRes = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: yandexClientId,
        client_secret: yandexClientSecret,
        redirect_uri: redirectUri
      })
    });

    if (!tokenRes.ok) {
      console.error('Yandex token error:', await tokenRes.text());
      return redirectWithError(res, appUrl, 'yandex_token_exchange_failed');
    }

    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) return redirectWithError(res, appUrl, 'yandex_access_token_missing');

    const userRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${tokenData.access_token}` }
    });

    if (!userRes.ok) {
      console.error('Yandex user info error:', await userRes.text());
      return redirectWithError(res, appUrl, 'yandex_user_info_failed');
    }

    const yandexUser = await userRes.json() as {
      id: string;
      login: string;
      real_name?: string;
      display_name?: string;
      default_email?: string;
      emails?: string[];
    };

    const email = yandexUser.default_email || yandexUser.emails?.[0] || `${yandexUser.login}@yandex.ru`;
    const displayName = yandexUser.real_name || yandexUser.display_name || yandexUser.login || email.split('@')[0];

    const { data: userLookup, error: lookupError } = await supabaseAdmin.auth.admin.getUserByEmail(email);

    if (lookupError && lookupError.status !== 404) {
      console.error('Supabase user lookup error:', lookupError);
      return redirectWithError(res, appUrl, 'supabase_user_lookup_failed');
    }

    if (!userLookup?.user) {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          yandex_id: yandexUser.id,
          full_name: displayName,
          name: displayName,
          provider: 'yandex'
        }
      });

      if (createError) {
        console.error('Supabase user create error:', createError);
        return redirectWithError(res, appUrl, 'supabase_user_creation_failed');
      }
    } else if (userLookup.user.user_metadata?.yandex_id !== yandexUser.id) {
      await supabaseAdmin.auth.admin.updateUserById(userLookup.user.id, {
        user_metadata: {
          ...userLookup.user.user_metadata,
          yandex_id: yandexUser.id,
          full_name: userLookup.user.user_metadata?.full_name || displayName,
          name: userLookup.user.user_metadata?.name || displayName,
          provider: userLookup.user.user_metadata?.provider || 'yandex'
        }
      });
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: appUrl
      }
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Supabase magic link error:', linkError);
      return redirectWithError(res, appUrl, 'supabase_magic_link_failed');
    }

    return res.redirect(linkData.properties.action_link);
  } catch (error) {
    console.error('Yandex OAuth callback error:', error);
    return redirectWithError(res, appUrl, 'yandex_server_error');
  }
}
