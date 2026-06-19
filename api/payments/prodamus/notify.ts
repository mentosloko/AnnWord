import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

const serviceKeyName = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
const env = (name: string, fallback = '') => process.env[name] || fallback;
const required = (name: string): string => { const value = process.env[name]; if (!value) throw new Error(`${name} is not configured`); return value; };
const admin = () => createClient(required('VITE_SUPABASE_URL'), required(serviceKeyName), { auth: { persistSession: false, autoRefreshToken: false } });
const bodyOf = (req: any): Record<string, unknown> => typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
const text = (value: unknown): string => String(value || '').trim();
const lower = (value: unknown): string => text(value).toLowerCase();
const isObject = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
const orderId = (body: Record<string, unknown>): string => text(body.order_id || body.order_num || body.order || body.invoice_id);
const paymentId = (body: Record<string, unknown>): string => text(body.payment_id || body.transaction_id || body.operation_id || body.id);
const isPaid = (body: Record<string, unknown>): boolean => { const allowed = env('PRODAMUS_PAID_STATUSES', 'success,paid,completed,complete,confirmed,authorized').split(',').map(item => item.trim().toLowerCase()).filter(Boolean); return [body.payment_status, body.status, body.state, body.operation_status, body.type].map(lower).some(value => allowed.includes(value)); };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const body = bodyOf(req);
    if (!trusted(req, body)) return res.status(401).send('Bad signature');
    const id = orderId(body);
    if (!id) return res.status(400).send('Missing order_id');
    const supabase = admin();
    const providerPaymentId = paymentId(body) || null;
    if (isPaid(body)) {
      const { error } = await supabase.rpc('activate_paid_premium_payment', { p_provider_order_id: id, p_provider_payment_id: providerPaymentId, p_raw_payload: body });
      if (error) throw error;
      return res.status(200).send('OK');
    }
    await supabase.from('premium_payments').update({ status: 'ignored', provider_payment_id: providerPaymentId, raw_payload: body }).eq('provider', 'prodamus').eq('provider_order_id', id).neq('status', 'paid');
    return res.status(200).send('OK');
  } catch (error: unknown) {
    console.error('Prodamus notify failed', error);
    return res.status(500).send(error instanceof Error ? error.message : 'Webhook failed');
  }
}
