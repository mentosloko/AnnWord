import { createHmac } from "node:crypto";
import { Router } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { query } from "../db";
import { readRequiredEnv, runtimeConfig } from "../config";
import { prodamusNotifyRouter } from "./prodamusNotifyRoutes";

export const paymentRouter = Router();

type Plan = { code: "kids_month" | "kids_year"; productName: string; amountRub: number; periodDays: 31 | 365; paidContent: string };

const plans: Record<string, Plan> = {
  kids_month: { code: "kids_month", productName: "Доступ к AnnWord Premium на 1 месяц", amountRub: 300, periodDays: 31, paidContent: "Доступ к AnnWord Premium на 1 месяц" },
  kids_year: { code: "kids_year", productName: "Доступ к AnnWord Premium на 1 год", amountRub: 3000, periodDays: 365, paidContent: "Доступ к AnnWord Premium на 1 год" },
};

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const appUrl = (): string => (process.env.PRODAMUS_APP_URL || runtimeConfig.appUrl || "https://annword.ru").replace(/\/+$/, "");
const apiUrl = (): string => (runtimeConfig.apiUrl || process.env.API_URL || appUrl()).replace(/\/+$/, "");
const appReturnUrl = (payment: "success" | "fail", orderId: string): string => `${appUrl()}/?payment=${payment}&order_id=${encodeURIComponent(orderId)}`;
const payformUrl = (): string => {
  const raw = (process.env.PRODAMUS_PAYFORM_HOST || "manto-school.payform.ru").trim();
  return (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, "");
};

const normalizeForSignature = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeForSignature);
  if (isObject(value)) {
    return Object.keys(value).sort().reduce((acc: Record<string, unknown>, key) => {
      if (key !== "signature" && key !== "sign" && typeof value[key] !== "undefined") acc[key] = normalizeForSignature(value[key]);
      return acc;
    }, {});
  }
  return String(value ?? "");
};
const signatureBody = (payload: Record<string, unknown>): string => JSON.stringify(normalizeForSignature(payload)).replace(/\//g, "\\/");
const sign = (payload: Record<string, unknown>): string => createHmac("sha256", readRequiredEnv("PRODAMUS_SECRET")).update(signatureBody(payload)).digest("hex");
const append = (params: URLSearchParams, key: string, value: unknown): void => {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) return value.forEach((item, index) => append(params, `${key}[${index}]`, item));
  if (isObject(value)) return Object.entries(value).forEach(([childKey, childValue]) => append(params, `${key}[${childKey}]`, childValue));
  params.append(key, String(value));
};
const queryString = (payload: Record<string, unknown>): string => { const params = new URLSearchParams(); Object.entries(payload).forEach(([key, value]) => append(params, key, value)); return params.toString(); };

paymentRouter.use(prodamusNotifyRouter);

paymentRouter.post("/create", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const plan = plans[String(req.body?.planCode || "")];
    if (!plan) {
      res.status(400).json({ error: "Unknown Premium plan" });
      return;
    }
    const user = req.user!;
    const orderId = `annword_${plan.code}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const callbackOrigin = apiUrl();
    const payload: Record<string, unknown> = {
      do: "pay",
      order_id: orderId,
      order_sum: String(plan.amountRub),
      customer_email: user.email,
      products: [{ name: plan.productName, price: String(plan.amountRub), quantity: "1", sku: plan.code, type: "service", paymentMethod: "1", paymentObject: "4" }],
      paid_content: plan.paidContent,
      urlSuccess: appReturnUrl("success", orderId),
      urlReturn: appReturnUrl("fail", orderId),
      urlNotification: `${callbackOrigin}/api/payments/prodamus/notify`,
      sys: process.env.PRODAMUS_SYS_CODE || "annword",
      currency: "rub",
      demo_mode: process.env.PRODAMUS_DEMO_MODE || "1",
      type: "json",
      callbackType: "json",
      payments_limit: "1",
      _param_user_id: user.id,
      _param_plan_code: plan.code,
    };
    payload.signature = sign(payload);
    const checkoutUrl = `${payformUrl()}/?${queryString(payload)}`;

    await query(
      `insert into premium_payments (user_id, provider, provider_order_id, plan_code, period_days, amount_rub, currency, status, checkout_url, customer_email, raw_payload)
       values ($1, 'prodamus', $2, $3, $4, $5, 'RUB', 'pending', $6, $7, $8::jsonb)`,
      [user.id, orderId, plan.code, plan.periodDays, plan.amountRub, checkoutUrl, user.email, JSON.stringify({ checkout: payload, signature_body: signatureBody(payload) })],
    );

    res.json({ orderId, checkoutUrl, plan: { code: plan.code, title: plan.productName, amountRub: plan.amountRub, periodDays: plan.periodDays } });
  } catch (error) {
    console.error("Prodamus create failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Payment create failed" });
  }
});
