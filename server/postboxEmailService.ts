interface MetadataTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface DeliveryResult {
  MessageId?: string;
  messageId?: string;
}

export interface PostboxEmailContent {
  subject: string;
  text: string;
  html?: string;
}

const METADATA_TOKEN_URL = 'http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token';
const POSTBOX_SEND_URL = 'https://postbox.cloud.yandex.net/v2/email/outbound-emails';
let tokenCache: { token: string; expiresAt: number } | null = null;

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Не задана переменная окружения ${name}.`);
  return value;
};

const getIamToken = async (): Promise<string> => {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const response = await fetch(METADATA_TOKEN_URL, { headers: { 'Metadata-Flavor': 'Google' } });
  if (!response.ok) throw new Error(`Не удалось получить IAM-токен: HTTP ${response.status}.`);
  const body = await response.json() as MetadataTokenResponse;
  if (!body.access_token) throw new Error('Сервис метаданных не вернул IAM-токен.');
  tokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(60, Number(body.expires_in || 300)) * 1000,
  };
  return tokenCache.token;
};

export async function sendPostboxEmail(to: string, content: PostboxEmailContent): Promise<string | null> {
  const token = await getIamToken();
  const from = requiredEnv('WEEKLY_REPORT_FROM_EMAIL');
  const body: Record<string, unknown> = {
    Text: { Data: content.text, Charset: 'UTF-8' },
  };
  if (content.html) body.Html = { Data: content.html, Charset: 'UTF-8' };

  const response = await fetch(POSTBOX_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-YaCloud-SubjectToken': token,
    },
    body: JSON.stringify({
      FromEmailAddress: from,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: content.subject, Charset: 'UTF-8' },
          Body: body,
        },
      },
    }),
  });

  const responseText = await response.text();
  if (!response.ok) throw new Error(`Postbox вернул HTTP ${response.status}: ${responseText.slice(0, 500)}`);
  try {
    const parsed = JSON.parse(responseText) as DeliveryResult;
    return parsed.MessageId || parsed.messageId || null;
  } catch {
    return null;
  }
}
