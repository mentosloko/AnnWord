const METADATA_TOKEN_URL = 'http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token';
const POSTBOX_SEND_URL = 'https://postbox.cloud.yandex.net/v2/email/outbound-emails';
const POSTBOX_SMOKE_RECIPIENT = 'mentosloko@gmail.com';

interface MetadataTokenResponse {
  access_token?: string;
}

interface DeliveryResult {
  MessageId?: string;
  messageId?: string;
}

export async function sendPostboxSmokeEmail(): Promise<{ recipient: string; messageId: string | null }> {
  const from = process.env.WEEKLY_REPORT_FROM_EMAIL?.trim();
  if (!from) throw new Error('Не задана переменная окружения WEEKLY_REPORT_FROM_EMAIL.');

  const tokenResponse = await fetch(METADATA_TOKEN_URL, {
    headers: { 'Metadata-Flavor': 'Google' },
  });
  if (!tokenResponse.ok) throw new Error(`Не удалось получить IAM-токен: HTTP ${tokenResponse.status}.`);
  const tokenBody = await tokenResponse.json() as MetadataTokenResponse;
  if (!tokenBody.access_token) throw new Error('Сервис метаданных не вернул IAM-токен.');

  const sentAt = new Date().toISOString();
  const response = await fetch(POSTBOX_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-YaCloud-SubjectToken': tokenBody.access_token,
    },
    body: JSON.stringify({
      FromEmailAddress: from,
      Destination: { ToAddresses: [POSTBOX_SMOKE_RECIPIENT] },
      Content: {
        Simple: {
          Subject: { Data: 'AnnWord: проверка отправки через Yandex Postbox', Charset: 'UTF-8' },
          Body: {
            Text: { Data: `Тестовое письмо AnnWord успешно отправлено через Yandex Cloud Postbox.\nВремя: ${sentAt}`, Charset: 'UTF-8' },
            Html: { Data: `<p>Тестовое письмо <strong>AnnWord</strong> успешно отправлено через Yandex Cloud Postbox.</p><p>Время: ${sentAt}</p>`, Charset: 'UTF-8' },
          },
        },
      },
    }),
  });

  const responseText = await response.text();
  if (!response.ok) throw new Error(`Postbox вернул HTTP ${response.status}: ${responseText.slice(0, 500)}`);

  let messageId: string | null = null;
  try {
    const parsed = JSON.parse(responseText) as DeliveryResult;
    messageId = parsed.MessageId || parsed.messageId || null;
  } catch {
    messageId = null;
  }

  return { recipient: POSTBOX_SMOKE_RECIPIENT, messageId };
}
