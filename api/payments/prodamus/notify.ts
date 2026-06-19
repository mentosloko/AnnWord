import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

const serviceKeyName = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
const env = (name: string, fallback = '') => process.env[name] || fallback;
const required = (name: string): string => { const value = process.env[name]; if (!value) throw new Error(`${name} is not configured`); return value; };
const admin = () => createClient(required('VITE_SUPABASE_URL'), required(serviceKeyName), { auth: { persistSession: false, autoRefreshToken: false } });
const text = (value: unknown): string => String(value || '').trim();
const lower = (value: unknown): string => text(value).toLowerCase();
const isObject = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseFormBody = (raw: string): Record<string, unknown> => {
  const params = new URLSearchParams(raw);
  const result: Record<string, unknown> = {};
  params.forEach((value, key) => { result[key] = value; });
  return result;
};

const bodyOf = (req: any): Record<string, unknown> => {
  const raw = req.body;
  if (!raw) return {};
  if (Buffer.isBuffer(raw)) return bodyOf({ body: raw.toString('utf8') });
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);
    return parseFormBody(trimmed);
  }
  if (isObject(raw)) return raw;
  return {};
};

const normalizeForSignature = (value: any): any => {
  if (Array.isArray(value)) return value.map(normalizeForSignature);
  if (isObject(value)) return Object.keys(value).sort().reduce((acc: Record<string, any>, key) => { if (key !== 'signature' && key !== 'sign' && typeof value[key] !== 'undefined') acc[key] = normalizeForSignature(value[key]); return acc; }, {});
  return String(value ?? '');
};
const signatureBody = (payload: Record<string, any>): string => JSON.stringify(normalizeForSignature(payload)).replace(/\//g, '\\/');
const sign = (payload: Record<string, any>, key: string): string => createHmac('sha256', key).update(signatureBody(payload)).digest('hex');
const safe = (left: string, right: string): boolean => { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); };
const incoming = (req: any, body: Record<string, unknown>): string => text(req.headers?.['x-signature'] || req.headers?.['x-prodamus-signature'] || req.headers?.signature || req.headers?.sign || body.signature || body.sign);
const trusted = (req: any, body: Record<string, unknown>): boolean => env('PRODAMUS_REQUIRE_WEBHOOK_SIGNATURE', 'true') === 'false' || safe(incoming(req, body), sign(body as Record<string, any>, required('PRODAMUS_SECRET_KEY')));
const orderId = (body: Record<string, unknown>): string => text(body.order_id || body.order_num || body.order || body.invoice_id || body.invoice_num || body._param_order_id);
const paymentId = (body: Record<string, unknown>): string => text(body.payment_id || body.transaction_id || body.operation_id || body.id || body.invoice_id || body.payment_num);
const isPaid = (body: Record<string, unknown>): boolean => {
  const allowed = env('PRODAMUS_PAID_STATUSES', 'success,paid,completed,complete,confirmed,authorized,approved,done,succeeded').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  return [body.payment_status, body.status, body.state, body.operation_status, body.invoice_status, body.payment_state].map(lower).some(value => allowed.includes(value));
};

const writeWebhookLog = async (supabase: SupabaseClient, body: Record<string, unknown>, status: string, signatureValid: boolean | null, paid: boolean | null, error?: unknown): Promise<void> => {
  const { error: insertError } = await supabase.from('prodamus_webhook_events').insert({
    provider_order_id: orderId(body) || null,
    provider_payment_id: paymentId(body) || null,
    status,
    signature_valid: signatureValid,
    is_paid: paid,
    error: error instanceof Error ? error.message : typeof error === 'string' ? error : null,
    raw_payload: body,
  });
  if (insertError) console.error('Failed to write Prodamus webhook log', insertError);
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const supabase = admin();
  let body: Record<string, unknown> = {};
  try {
    body = bodyOf(req);
    const signatureValid = trusted(req, body);
    const paid = isPaid(body);
    if (!signatureValid) {
      await writeWebhookLog(supabase, body, 'bad_signature', false, paid);
      return res.status(401).send('Bad signature');
    }
    const id = orderId(body);
    if (!id) {
      await writeWebhookLog(supabase, body, 'missing_order_id', true, paid);
      return res.status(400).send('Missing order_id');
    }
    const providerPaymentId = paymentId(body) || null;
    if (paid) {
      const { error } = await supabase.rpc('activate_paid_premium_payment', { p_provider_order_id: id, p_provider_payment_id: providerPaymentId, p_raw_payload: body });
      if (error) throw error;
      await writeWebhookLog(supabase, body, 'paid', true, true);
      return res.status(200).send('OK');
    }
    await supabase.from('premium_payments').update({ status: 'ignored', provider_payment_id: providerPaymentId, raw_payload: body }).eq('provider', 'prodamus').eq('provider_order_id', id).neq('status', 'paid');
    await writeWebhookLog(supabase, body, 'ignored', true, false);
    return res.status(200).send('OK');
  } catch (error: unknown) {
    console.error('Prodamus notify failed', error);
    await writeWebhookLog(supabase, body, 'error', null, null, error).catch(logError => console.error('Failed to log Prodamus webhook error', logError));
    return res.status(500).send(error instanceof Error ? error.message : 'Webhook failed');
  }
}
