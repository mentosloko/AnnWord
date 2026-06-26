type MagicLinkPayload = {
  email: string;
  link: string;
  expiresAt: string;
};

const readWebhookUrl = (): string => process.env.EMAIL_MAGIC_LINK_WEBHOOK_URL?.trim() || "";

export async function sendMagicLinkEmail(payload: MagicLinkPayload): Promise<void> {
  const webhookUrl = readWebhookUrl();
  if (!webhookUrl) {
    if (process.env.NODE_ENV !== "production") {
      console.info("AnnWord magic link", payload);
      return;
    }
    throw new Error("Email magic link webhook is not configured");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      to: payload.email,
      subject: "Ссылка для входа в AnnWord",
      text: `Здравствуйте! Чтобы войти в AnnWord, откройте ссылку: ${payload.link}\n\nСсылка действует до ${payload.expiresAt}.`,
      html: `<p>Здравствуйте!</p><p>Чтобы войти в AnnWord, откройте ссылку:</p><p><a href="${payload.link}">Войти в AnnWord</a></p><p>Ссылка действует до ${payload.expiresAt}.</p>`,
      link: payload.link,
      expiresAt: payload.expiresAt,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Magic link email delivery failed: ${response.status}${detail ? ` ${detail}` : ""}`);
  }
}