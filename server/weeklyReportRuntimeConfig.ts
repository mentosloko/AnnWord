import { createHmac } from "node:crypto";
import { runtimeConfig } from "./config";

const METADATA_TOKEN_URL = "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token";
const POSTBOX_IDENTITIES_URL = "https://postbox.cloud.yandex.net/v2/email/identities?PageSize=1000";
const WEEKLY_CRON_PURPOSE = "annword-weekly-reports-v1";

type IdentityResponse = {
  EmailIdentities?: Array<{
    IdentityName?: string;
    SendingEnabled?: boolean;
    VerificationStatus?: string;
  }>;
};

const hostFromAppUrl = (): string => {
  try {
    const hostname = new URL(runtimeConfig.appUrl).hostname.replace(/^www\./, "").toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || /^127\./.test(hostname)) return "annword.ru";
    return hostname;
  } catch {
    return "annword.ru";
  }
};

export const deriveWeeklyReportCronToken = (): string => {
  const rootSecret = process.env.JWT_SECRET?.trim() || "";
  if (!rootSecret) return "";
  return createHmac("sha256", rootSecret).update(WEEKLY_CRON_PURPOSE).digest("hex");
};

export const defaultWeeklyReportFromEmail = (): string => `reports@${hostFromAppUrl()}`;

/**
 * The old Vercel deployment used separate cron and sender environment values.
 * The Yandex container already has JWT_SECRET and a verified application
 * domain, so use deterministic internal auth and the domain sender as safe
 * defaults while still allowing explicit environment overrides.
 */
export const ensureWeeklyReportRuntimeConfig = (): void => {
  if (!process.env.WEEKLY_REPORT_CRON_SECRET?.trim()) {
    process.env.WEEKLY_REPORT_CRON_SECRET = deriveWeeklyReportCronToken();
  }
  if (!process.env.WEEKLY_REPORT_FROM_EMAIL?.trim()) {
    process.env.WEEKLY_REPORT_FROM_EMAIL = defaultWeeklyReportFromEmail();
  }
};

export async function inspectWeeklyReportRuntime(): Promise<{
  configured: boolean;
  senderDomain: string;
  senderSource: "environment" | "default";
  cronAuthConfigured: boolean;
  postboxIdentityVerified: boolean | null;
  postboxIdentityError?: string;
}> {
  const explicitSender = Boolean(process.env.WEEKLY_REPORT_FROM_EMAIL?.trim());
  ensureWeeklyReportRuntimeConfig();
  const sender = process.env.WEEKLY_REPORT_FROM_EMAIL?.trim() || "";
  const senderDomain = sender.includes("@") ? sender.split("@").pop() || "" : "";
  const cronAuthConfigured = Boolean(process.env.WEEKLY_REPORT_CRON_SECRET?.trim());

  let postboxIdentityVerified: boolean | null = null;
  let postboxIdentityError: string | undefined;
  try {
    const tokenResponse = await fetch(METADATA_TOKEN_URL, { headers: { "Metadata-Flavor": "Google" } });
    if (!tokenResponse.ok) throw new Error(`metadata HTTP ${tokenResponse.status}`);
    const tokenBody = await tokenResponse.json() as { access_token?: string };
    if (!tokenBody.access_token) throw new Error("metadata token missing");
    const identitiesResponse = await fetch(POSTBOX_IDENTITIES_URL, {
      headers: { "X-YaCloud-SubjectToken": tokenBody.access_token },
    });
    const identitiesText = await identitiesResponse.text();
    if (!identitiesResponse.ok) throw new Error(`Postbox HTTP ${identitiesResponse.status}: ${identitiesText.slice(0, 200)}`);
    const identities = JSON.parse(identitiesText) as IdentityResponse;
    postboxIdentityVerified = Boolean((identities.EmailIdentities || []).some((identity) =>
      identity.IdentityName?.toLowerCase() === senderDomain.toLowerCase()
      && identity.SendingEnabled === true
      && identity.VerificationStatus === "SUCCESS"
    ));
  } catch (error) {
    postboxIdentityError = error instanceof Error ? error.message : String(error);
  }

  return {
    configured: Boolean(sender && cronAuthConfigured),
    senderDomain,
    senderSource: explicitSender ? "environment" : "default",
    cronAuthConfigured,
    postboxIdentityVerified,
    ...(postboxIdentityError ? { postboxIdentityError } : {}),
  };
}

ensureWeeklyReportRuntimeConfig();
