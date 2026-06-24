import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { query } from "../db";
import { runtimeConfig } from "../config";

export const prodamusNotifyRouter = Router();

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string => String(value || "").trim();
const lower = (value: unknown): string => text(value).toLowerCase();
const normalizeForSignature = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeForSignature);
  if (isObject(value)) return Object.keys(value).sort().reduce((acc: Record<string, unknown>, key) => { if (key !== "signature" && key !== "sign" && typeof value[key] !== "undefined") acc[key] = normalizeForSignature(value[key]); return acc; }, {});
  return String(value ?? "");
};
const signatureBody = (payload: Record<string, unknown>): string => JSON.stringify(normalizeForSignature(payload)).replace(/\//g, "\\/");
const sign = (payload: Record<string, unknown>): string => createHmac("sha256", runtimeConfig.prodamusSecret || "").update(signatureBody(payload)).digest("hex");
const safe = (left: string, right: string): boolean => { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); };
const cleanSignature = (value: unknown): string => text(value).replace(/^sign:\s*/i, "");
const incomingSignature = (headers: Record<string, unknown>, body: Record<string, unknown>): string => cleanSignature(headers["x-signature"] || headers["x-prodamus-signature"] || headers.signature || headers.sign || body.signature || body.sign);
const isTrusted = (headers: Record<string, unknown>, body: Record<string, unknown>): boolean => process.env.PRODAMUS_REQUIRE_WEBHOOK_SIGNATURE === "false" || (Boolean(runtimeConfig.prodamusSecret) && safe(incomingSignature(headers, body), sign(body)));
const readProviderOrderId = (body: Record<string, unknown>): string => text(body.order_num || body._param_order_id || body.order || body.invoice_num || body.order_id || body.invoice_id);
const readProviderPaymentId = (body: Record<string, unknown>): string => text(body.payment_id || body.transaction_id || body.operation_id || body.id || body.invoice_id || body.payment_num || body.order_id);
const isPaidPayload = (body: Record<string, unknown>): boolean => {
  const allowed = (process.env.PRODAMUS_PAID_STATUSES || "success,paid,completed,complete,confirmed,authorized,approved,done,succeeded").split(",").map(item => item.trim().toLowerCase()).filter(Boolean);
  return [body.payment_status, body.status, body.state, body.operation_status, body.invoice_status, body.payment_state].map(lower).some(value => allowed.includes(value));
};
const writeWebhookLog = async (body: Record<string, unknown>, status: string, signatureValid: boolean | null, paid: boolean | null, error?: unknown): Promise<void> => {
  await query(`insert into prodamus_webhook_events (provider_order_id, provider_payment_id, status, signature_valid, is_paid, error, raw_payload) values ($1, $2, $3, $4, $5, $6, $7::jsonb)`, [readProviderOrderId(body) || null, readProviderPaymentId(body) || null, status, signatureValid, paid, error instanceof Error ? error.message : typeof error === "string" ? error : null, JSON.stringify(body)]).catch(logError => console.error("Failed to write Prodamus webhook log", logError));
};
const isOrderNotFound = (error: unknown): boolean => error instanceof Error && /payment order not found/i.test(error.message);

prodamusNotifyRouter.post("/notify", async (req, res) => {
  const body = (isObject(req.body) ? req.body : {}) as Record<string, unknown>;
  try {
    const trusted = isTrusted(req.headers as Record<string, unknown>, body);
    const paid = isPaidPayload(body);
    if (!trusted) { await writeWebhookLog(body, "bad_signature", false, paid); res.status(401).send("Bad signature"); return; }
    const providerOrderId = readProviderOrderId(body);
    if (!providerOrderId) { await writeWebhookLog(body, "missing_order_id", true, paid); res.status(200).send("OK"); return; }
    const providerPaymentId = readProviderPaymentId(body) || null;
    if (paid) {
      try {
        await query("select public.activate_paid_premium_payment($1, $2, $3::jsonb)", [providerOrderId, providerPaymentId, JSON.stringify(body)]);
        await writeWebhookLog(body, "paid", true, true);
      } catch (error) {
        if (!isOrderNotFound(error)) throw error;
        await writeWebhookLog(body, "order_not_found", true, true, error);
      }
      res.status(200).send("OK");
      return;
    }
    await query("update premium_payments set status = 'ignored', provider_payment_id = $1, raw_payload = $2::jsonb where provider = 'prodamus' and provider_order_id = $3 and status <> 'paid'", [providerPaymentId, JSON.stringify(body), providerOrderId]);
    await writeWebhookLog(body, "ignored", true, false);
    res.status(200).send("OK");
  } catch (error) {
    console.error("Prodamus notify failed", error);
    await writeWebhookLog(body, "error", null, null, error);
    res.status(500).send(error instanceof Error ? error.message : "Webhook failed");
  }
});