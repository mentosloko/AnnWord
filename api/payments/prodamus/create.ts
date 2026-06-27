import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { publicCallbackUrl } from '../../_lib/publicCallbackUrl';

const serviceKeyName = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
const env = (name: string, fallback = '') => process.env[name] || fallback;
const required = (name: string): string => { const value = process.env[name]; if (!value) throw new Error(`${name} is not configured`); return value; };
const admin = () => createClient(required('VITE_SUPABASE_URL'), required(serviceKeyName), { auth: { persistSession: false, autoRefreshToken: false } });
const tokenOf = (header: unknown): string | null => typeof header === 'string' ? header.replace(/^Bearer\s+/i, '').trim() || null : null;
const bodyOf = (req: any): Record<string, unknown> => typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
const appUrl = () => env('PRODAMUS_APP_URL', env('APP_URL', 'https://ann-word.vercel.app')).replace(/\/+$/, '');
const payformUrl = () => { const raw = env('PRODAMUS_PAYFORM_HOST', 'manto-school.payform.ru').trim(); return (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, ''); };

const PLACEHOLDER_RE = /(^|[\/.:-])(api_url|prodamus_payform_host|payform_host|example\.com|your-domain|ann-word\.vercel\.app)([\/.:-]|$)/i;
const publicUrl = (label: string, value: string): string => {
  if (!value || PLACEHOLDER_RE.test(value)) throw new Error(`${label} is not configured with a production URL`);
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`${label} must be an absolute URL`); }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error(`${label} must use http or https`);
  return value.replace(/\/+$/, '');
};

type Plan = { code: string; months: 1 | 12; productName: string; amountRub: number; periodDays: number; paidContent: string };
const plans: Record<string, Plan> = {
  kids_month: { code: 'kids_month', months: 1, productName: 'AnnWord Premium — 1 месяц', amountRub: 300, periodDays: 31, paidContent: 'Доступ к AnnWord Premium на 1 месяц' },
  kids_year: { code: 'kids_year', months: 12, productName: 'AnnWord Premium — 1 год', amountRub: 3000, periodDays: 365, paidContent: 'Доступ к AnnWord Premium на 1 год' },
};
const isObject = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const normalizeForSignature = (value: any): any => {
  if (Array.isArray(value)) return value.map(normalizeForSignature);
  if (isObject(value)) return Object.keys(value).sort().reduce((acc: Record<string, any>, key) => { if (key !== 'signature' && key !== 'sign' && typeof value[key] !== 'undefined') acc[key] = normalizeForSignature(value[key]); return acc; }, {});
  return String(value ?? '');
};
const signatureBody = (payload: Record<string, any>): string => JSON.stringify(normalizeForSignature(payload)).replace(/\//g, '\\/');
const sign = (payload: Record<string, any>, key: string): string => createHmac('sha256', key).update(signatureBody(payload)).digest('hex');
const append = (params: URLSearchParams, key: string, value: any): void => { if (value === undefined || value === null) return; if (Array.isArray(value)) return value.forEach((item, index) => append(params, `${key}[${index}]`, item)); if (isObject(value)) return Object.entries(value).forEach(([childKey, childValue]) => append(params, `${key}[${childKey}]`, childValue)); params.append(key, String(value)); };
const query = (payload: Record<string, any>): string => { const params = new URLSearchParams(); Object.entries(payload).forEach(([key, value]) => append(params, key, value)); return params.toString(); };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = bodyOf(req);
    const plan = plans[String(body.planCode || '')];
    if (!plan) return res.status(400).json({ error: 'Unknown Premium plan' });
    const token = tokenOf(req.headers.authorization);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const supabase = admin();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return res.status(401).json({ error: 'Unauthorized' });
    const orderId = `annword_${plan.code}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const origin = publicUrl('PRODAMUS_APP_URL/APP_URL', appUrl());
    const callbackOrigin = publicUrl('PRODAMUS_NOTIFICATION_APP_URL/PRODAMUS_PUBLIC_APP_URL', publicCallbackUrl());
    const paymentOrigin = publicUrl('PRODAMUS_PAYFORM_HOST', payformUrl());
    const email = userData.user.email || '';
    const payload: Record<string, any> = {
      do: 'pay',
      order_id: orderId,
      order_sum: String(plan.amountRub),
      customer_email: email,
      products: [{
        name: plan.productName,
        price: String(plan.amountRub),
        quantity: '1',
        sku: plan.code,
        type: 'service',
        paymentMethod: '1',
        paymentObject: '4',
      }],
      paid_content: plan.paidContent,
      urlSuccess: `${origin}/payment/success?order_id=${encodeURIComponent(orderId)}`,
      urlReturn: `${origin}/payment/fail?order_id=${encodeURIComponent(orderId)}`,
      urlNotification: `${callbackOrigin}/api/payments/prodamus/notify`,
      sys: env('PRODAMUS_SYS_CODE', 'annword'),
      currency: 'rub',
      demo_mode: '1',
      type: 'json',
      callbackType: 'json',
      payments_limit: '1',
      _param_user_id: userData.user.id,
      _param_plan_code: plan.code,
    };
    payload.signature = sign(payload, required('PRODAMUS_SECRET_KEY'));
    const checkoutUrl = `${paymentOrigin}/?${query(payload)}`;
    const { error: insertError } = await supabase.from('premium_payments').insert({ user_id: userData.user.id, provider: 'prodamus', provider_order_id: orderId, plan_code: plan.code, period_days: plan.periodDays, amount_rub: plan.amountRub, currency: 'RUB', status: 'pending', checkout_url: checkoutUrl, customer_email: email, raw_payload: { checkout: payload, signature_body: signatureBody(payload), product_name: plan.productName, paid_content: plan.paidContent, demo_mode: true } });
    if (insertError) throw insertError;
    return res.status(200).json({ orderId, checkoutUrl, plan: { code: plan.code, title: plan.productName, amountRub: plan.amountRub, periodDays: plan.periodDays } });
  } catch (error: unknown) {
    console.error('Prodamus create failed', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Payment create failed' });
  }
}