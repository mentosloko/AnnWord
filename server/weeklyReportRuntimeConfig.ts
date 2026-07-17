import { createHmac } from "node:crypto";
import { runtimeConfig } from "./config";

const METADATA_TOKEN_URL = "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token";
const POSTBOX_IDENTITIES_URL = "https://postbox.cloud.yandex.net/v2/email/identities?PageSize=1000";
const WEEKLY_CRON_PURPOSE = "annword-weekly-reports-v1";

type PostboxIdentity = {
  IdentityType?: string;
  IdentityName?: string;
  SendingEnabled?: boolean;
  VerificationStatus?: string;
};

type IdentityResponse = { EmailIdentities?: PostboxIdentity[] };

const hostFromAppUrl = (): string => {
  try {
    const hostname = new URL(runtimeConfig.appUrl).hostname.replace(/^www\./, "").toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || /^127\./.test(hostname)) return "annword.ru";
    return hostname;
  } catch {
    return "annword.ru";
  }
};

const domainFromSender = (sender: string): string => sender.includes("@") ? sender.split("@").pop()?.toLowerCase() || "" : "";
const isVerifiedIdentity = (identity: PostboxIdentity): boolean => Boolean(
  identity.IdentityName?.trim()
  && identity.SendingEnabled === true
  && identity.VerificationStatus === "SUCCESS"
);
const senderForIdentity = (identity: PostboxIdentity): string => {
  const name = identity.IdentityName?.trim().toLowerCase() || "";
  return name.includes("@") ? name : `reports@${name}`;
};

export const deriveWeeklyReportCronToken = (): string => {
  const rootSecret = process.env.JWT_SECRET?.trim() || "";
  if (!rootSecret) return "";
  return createHmac("sha256", rootSecret).update(WEEKLY_CRON_PURPOSE).digest("hex");
};

export const defaultWeeklyReportFromEmail = (): string => `reports@${hostFromAppUrl()}`;

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
  senderSource: "environment" | "default" | "verified-identity-fallback";
  cronAuthConfigured: boolean;
  postboxIdentityVerified: boolean | null;
  verifiedIdentityCount: number | null;
  postboxIdentityError?: string;
}> {
  const hadExplicitSender = Boolean(process.env.WEEKLY_REPORT_FROM_EMAIL?.trim());
  ensureWeeklyReportRuntimeConfig();
  let sender = process.env.WEEKLY_REPORT_FROM_EMAIL?.trim().toLowerCase() || "";
  let senderDomain = domainFromSender(sender);
  let senderSource: "environment" | "default" | "verified-identity-fallback" = hadExplicitSender ? "environment" : "default";
  const cronAuthConfigured = Boolean(process.env.WEEKLY_REPORT_CRON_SECRET?.trim());

  let postboxIdentityVerified: boolean | null = null;
  let verifiedIdentityCount: number | null = null;
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
    const identityResponse = JSON.parse(identitiesText) as IdentityResponse;
    const verifiedIdentities = (identityResponse.EmailIdentities || []).filter(isVerifiedIdentity);
    verifiedIdentityCount = verifiedIdentities.length;

    const configuredIdentity = verifiedIdentities.find((identity) => {
      const name = identity.IdentityName?.trim().toLowerCase() || "";
      return name === sender.toLowerCase() || name === senderDomain;
    });
    const selectedIdentity = configuredIdentity || verifiedIdentities[0];
    if (selectedIdentity) {
      const selectedSender = senderForIdentity(selectedIdentity);
      if (!configuredIdentity) {
        sender = selectedSender;
        senderDomain = domainFromSender(selectedSender);
        senderSource = "verified-identity-fallback";
        process.env.WEEKLY_REPORT_FROM_EMAIL = selectedSender;
      }
      postboxIdentityVerified = true;
    } else {
      postboxIdentityVerified = false;
    }
  } catch (error) {
    postboxIdentityError = error instanceof Error ? error.message : String(error);
  }

  return {
    configured: Boolean(sender && cronAuthConfigured && postboxIdentityVerified === true),
    senderDomain,
    senderSource,
    cronAuthConfigured,
    postboxIdentityVerified,
    verifiedIdentityCount,
    ...(postboxIdentityError ? { postboxIdentityError } : {}),
  };
}

ensureWeeklyReportRuntimeConfig();
