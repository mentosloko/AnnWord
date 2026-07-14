import { createHmac } from "node:crypto";
import { Router } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { query } from "../db";
import { runtimeConfig, readPublicHostEnv, readPublicUrlEnv } from "../config";
import { prodamusNotifyRouter } from "./prodamusNotifyRoutes";

export const paymentRouter = Router();

type PlanCode = "kids_month" | "kids_year" | "practice_month" | "practice_year";
type Plan = { code: PlanCode; productName: string; amountRub: number; periodDays: 31 | 365; paidContent: string; mode: "kids" | "practice" };
type PaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded" | "ignored";

const plans: Record<PlanCode, Plan> = {
  kids_month: { code: "kids_month", productName: "AnnWord Kids Premium — 1 месяц", amountRub: 300, periodDays: 31, paidContent: "AnnWord Kids Premium — 1 месяц", mode: "kids" },
  kids_year: { code: "kids_year", productName: "AnnWord Kids Premium — 1 год", amountRub: 3000, periodDays: 365, paidContent: "AnnWord Kids Premium — 1 год", mode: "kids" },
  practice_month: { code: "practice_month", productName: "AnnWord Premium — 1 месяц", amountRub: 300, periodDays: 31, paidContent: "AnnWord Premium — 1 месяц", mode: "practice" },
  practice_year: { code: "practice_year", productName: "AnnWord Premium — 1 год", amountRub: 3000, periodDays: 365, paidContent: "AnnWord Premium — 1 год", mode: "practice" },
};

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const env = (name: string): string => (process.env[name] || "").trim();
const text = (value: unknown): string => String(value || "").trim();
const withoutSlash = (value: string): string => value.replace(/\/+$/, "");
const appUrl = (): string => withoutSlash(readPublicUrlEnv("PRODAMUS_APP_URL") || runtimeConfig.appUrl || "https://annword.ru");
const apiUrl = (): string => withoutSlash(readPublicUrlEnv("PRODAMUS_NOTIFICATION_APP_URL") || readPublicUrlEnv("PRODAMUS_PUBLIC_APP_URL") || runtimeConfig.apiUrl || readPublicUrlEnv("API_URL") || readPublicUrlEnv("YC_API_PUBLIC_URL") || "https://api.annword.ru");
const appReturnUrl = (payment: "success" | "pending" | "error" | "fail", orderId: string, reason?: string): string => {
  const url = new URL(appUrl());
  url.searchParams.set("payment", payment);
  url.searchParams.set("order_id", orderId);
  if (reason) url.searchParams.set("reason", reason);
  return url.toString();
};
const successEndpointUrl = (orderId: string): string => `${apiUrl()}/api/payments/prodamus/success?order_id=${encodeURIComponent(orderId)}`;
const prodamusDemoMode = (): string => env("PRODAMUS_DEMO_MODE") || "0";
const payformUrl = (): string => {
  const raw = readPublicHostEnv("PRODAMUS_PAYFORM_HOST") || "manto-school.payform.ru";
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
const sign = (payload: Record<string, unknown>): string => createHmac("sha256", runtimeConfig.prodamusSecret!).update(signatureBody(payload)).digest("hex");
const append = (params: URLSearchParams, key: string, value: unknown): void => {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) return value.forEach((item, index) => append(params, `${key}[${index}]`, item));
  if (isObject(value)) return Object.entries(value).forEach(([childKey, childValue]) => append(params, `${key}[${childKey}]`, childValue));
  params.append(key, String(value));
};
const queryString = (payload: Record<string, unknown>): string => { const params = new URLSearchParams(); Object.entries(payload).forEach(([key, value]) => append(params, key, value)); return params.toString(); };
const isDemoCheckout = (rawPayload: unknown): boolean => {
  if (!isObject(rawPayload)) return false;
  const checkout = isObject(rawPayload.checkout) ? rawPayload.checkout : {};
  const demo = checkout.demo_mode ?? rawPayload.demo_mode;
  return demo === "1" || demo === 1 || demo === true;
};
const redirectToApp = (res: { redirect: (status: number, url: string) => void }, payment: "success" | "pending" | "error" | "fail", orderId: string, reason?: string): void => {
  res.redirect(302, appReturnUrl(payment, orderId, reason));
};

paymentRouter.use(prodamusNotifyRouter);

paymentRouter.post("/create", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!runtimeConfig.prodamusSecret) {
      res.status(503).json({ code: "payments_not_configured", error: "Оплата Premium временно не настроена. Нужно добавить PRODAMUS_SECRET в окружение backend и повторить попытку." });
      return;
    }

    const plan = plans[String(req.body?.planCode || "") as PlanCode];
    if (!plan) {
      res.status(400).json({ code: "unknown_premium_plan", error: "Неизвестный тариф Premium." });
      return;
    }
    const user = req.user!;
    const profileResult = await query<{ role: string | null; account_mode: string | null }>("select role, account_mode from profiles where id = $1", [user.id]);
    const profile = profileResult.rows[0];
    const accountMode = profile?.role === "parent" || profile?.account_mode === "parent" ? "kids" : profile?.role === "teacher" || profile?.account_mode === "teacher" ? "teacher" : "practice";
    if (accountMode === "teacher" || accountMode !== plan.mode) {
      res.status(400).json({ code: "premium_plan_mode_mismatch", error: "Выбранный тариф не соответствует режиму аккаунта." });
      return;
    }

    const orderId = `annword_${plan.code}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const callbackOrigin = apiUrl();
    const payload: Record<string, unknown> = {
      do: "pay",
      order_id: orderId,
      order_sum: String(plan.amountRub),
      customer_email: user.email,
      products: [{ name: plan.productName, price: String(plan.amountRub), quantity: "1", sku: plan.code, type: "service", paymentMethod: "1", paymentObject: "4" }],
      paid_content: plan.paidContent,
      urlSuccess: successEndpointUrl(orderId),
      urlReturn: appReturnUrl("fail", orderId, "payment_cancelled"),
      urlNotification: `${callbackOrigin}/api/payments/prodamus/notify`,
      sys: process.env.PRODAMUS_SYS_CODE || "annword",
      currency: "rub",
      demo_mode: prodamusDemoMode(),
      type: "json",
      callbackType: "json",
      payments_limit: "1",
      _param_user_id: user.id,
      _param_plan_code: plan.code,
      _param_account_mode: plan.mode,
    };
    payload.signature = sign(payload);
    const checkoutUrl = `${payformUrl()}/?${queryString(payload)}`;

    await query(
      `insert into premium_payments (user_id, provider, provider_order_id, plan_code, period_days, amount_rub, currency, status, checkout_url, customer_email, raw_payload)
       values ($1, 'prodamus', $2, $3, $4, $5, 'RUB', 'pending', $6, $7, $8::jsonb)`,
      [user.id, orderId, plan.code, plan.periodDays, plan.amountRub, checkoutUrl, user.email, JSON.stringify({ checkout: payload, signature_body: signatureBody(payload) })],
    );

    res.json({ orderId, checkoutUrl, plan: { code: plan.code, title: plan.productName, amountRub: plan.amountRub, periodDays: plan.periodDays, mode: plan.mode } });
  } catch (error) {
    console.error("Prodamus create failed", error);
    res.status(500).json({ code: "payment_create_failed", error: error instanceof Error ? error.message : "Payment create failed" });
  }
});

paymentRouter.get("/history", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await query<{
      provider_order_id: string;
      plan_code: PlanCode;
      amount_rub: number;
      status: PaymentStatus;
      created_at: string | Date;
      premium_expires_at: string | Date | null;
    }>(
      `select provider_order_id, plan_code, amount_rub, status, created_at, premium_expires_at
         from premium_payments
        where user_id = $1
          and provider = 'prodamus'
        order by created_at desc
        limit 50`,
      [req.user!.id],
    );
    res.json({ payments: result.rows.map(row => ({
      orderId: row.provider_order_id,
      planCode: row.plan_code,
      amountRub: Number(row.amount_rub || 0),
      status: row.status,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      premiumExpiresAt: row.premium_expires_at instanceof Date ? row.premium_expires_at.toISOString() : row.premium_expires_at ? String(row.premium_expires_at) : null,
    })) });
  } catch (error) {
    console.error("Premium payment history failed", error);
    res.status(500).json({ code: "payment_history_failed", error: "Не удалось загрузить историю оплат." });
  }
});

paymentRouter.get("/success", async (req, res) => {
  const orderId = text(req.query.order_id || req.query.orderId || req.query.order_num || req.query.order);
  if (!orderId) {
    redirectToApp(res, "error", "", "missing_order_id");
    return;
  }

  try {
    const paymentResult = await query<{ status: PaymentStatus; provider_payment_id: string | null; raw_payload: unknown }>(
      `select status, provider_payment_id, raw_payload
         from premium_payments
        where provider = 'prodamus'
          and provider_order_id = $1
        limit 1`,
      [orderId],
    );
    const payment = paymentResult.rows[0];
    if (!payment) {
      redirectToApp(res, "error", orderId, "order_not_found");
      return;
    }

    if (payment.status === "paid") {
      redirectToApp(res, "success", orderId);
      return;
    }

    if (isDemoCheckout(payment.raw_payload)) {
      await query("select public.activate_paid_premium_payment($1, $2, $3::jsonb)", [orderId, payment.provider_payment_id, JSON.stringify({ source: "demo_success_redirect", order_id: orderId, query: req.query || {} })]);
      await query(
        `insert into prodamus_webhook_events (provider_order_id, provider_payment_id, status, signature_valid, is_paid, raw_payload)
         values ($1, $2, 'demo_success_redirect', null, true, $3::jsonb)`,
        [orderId, payment.provider_payment_id, JSON.stringify({ source: "success_redirect", query: req.query || {} })],
      ).catch(logError => console.error("Failed to write Prodamus success log", logError));
      redirectToApp(res, "success", orderId);
      return;
    }

    redirectToApp(res, "success", orderId);
  } catch (error) {
    console.error("Prodamus success redirect failed", error);
    await query(
      `insert into prodamus_webhook_events (provider_order_id, status, signature_valid, is_paid, error, raw_payload)
       values ($1, 'success_error', null, null, $2, $3::jsonb)`,
      [orderId, error instanceof Error ? error.message : "Success redirect failed", JSON.stringify({ source: "success_redirect", query: req.query || {} })],
    ).catch(logError => console.error("Failed to write Prodamus success error log", logError));
    redirectToApp(res, "error", orderId, "activation_failed");
  }
});

paymentRouter.get("/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  const orderId = text(req.query.order_id || req.query.orderId || req.query.order_num || req.query.order);
  if (!orderId) {
    res.status(400).json({ code: "missing_order_id", error: "missing_order_id" });
    return;
  }

  try {
    const user = req.user!;
    const result = await query<{
      provider_order_id: string;
      provider_payment_id: string | null;
      payment_status: PaymentStatus;
      plan_code: PlanCode;
      payment_premium_expires_at: string | null;
      subscription_tier: string;
      profile_premium_expires_at: string | null;
      premium_active: boolean;
    }>(
      `select p.provider_order_id,
              p.provider_payment_id,
              p.status as payment_status,
              p.plan_code,
              p.premium_expires_at::text as payment_premium_expires_at,
              pr.subscription_tier,
              pr.premium_expires_at::text as profile_premium_expires_at,
              (pr.subscription_tier = 'premium' and (pr.premium_expires_at is null or pr.premium_expires_at > now())) as premium_active
         from premium_payments p
         join profiles pr on pr.id = p.user_id
        where p.provider = 'prodamus'
          and p.provider_order_id = $1
          and p.user_id = $2
        limit 1`,
      [orderId, user.id],
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ status: "not_found", orderId, paymentStatus: "not_found", premiumActive: false });
      return;
    }

    res.json({
      status: "ok",
      orderId: row.provider_order_id,
      providerPaymentId: row.provider_payment_id,
      paymentStatus: row.payment_status,
      planCode: row.plan_code,
      premiumActive: row.premium_active,
      premiumExpiresAt: row.profile_premium_expires_at || row.payment_premium_expires_at,
    });
  } catch (error) {
    console.error("Prodamus status failed", error);
    res.status(500).json({ code: "payment_status_failed", error: error instanceof Error ? error.message : "Payment status failed" });
  }
});