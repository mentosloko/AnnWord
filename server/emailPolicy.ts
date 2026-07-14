import { domainToASCII } from "node:url";

export const RUSSIAN_EMAIL_DOMAIN_MESSAGE = "Регистрация доступна только для адресов в российских доменных зонах .ru и .рф. Это ограничение связано с требованиями к хранению и обработке данных пользователей в России.";

export function isRussianRegistrationEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop() || "";
  if (!domain) return false;
  const ascii = domainToASCII(domain).toLowerCase();
  return domain.endsWith(".ru") || domain.endsWith(".рф") || ascii.endsWith(".ru") || ascii.endsWith(".xn--p1ai") || ascii === "xn--p1ai";
}

export function assertRussianRegistrationEmail(email: string): void {
  if (!isRussianRegistrationEmail(email)) {
    const error = new Error(RUSSIAN_EMAIL_DOMAIN_MESSAGE) as Error & { code?: string };
    error.code = "russian_email_domain_required";
    throw error;
  }
}
