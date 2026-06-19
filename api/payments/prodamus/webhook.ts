import { createClient } from '@supabase/supabase-js';
import { optional, required } from '../../_lib/serverEnv';
import { makeSignature, safeEqual } from '../../_lib/prodamusSign';

const serviceKeyName = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
const getAdmin = () => createClient(required('VITE_SUPABASE_URL'), required(serviceKeyName), { auth: { persistSession: false, autoRefreshToken: false } });
const readBody = (req: any): Record<string, unknown> => typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
const text = (value: unknown): string => String(value || '').trim();
const lower = (value: unknown): string => text(value).toLowerCase();
const orderIdOf = (body: Record<string, unknown>): string => text(body.order_id || body.order_num || body.order || body.invoice_id) || '';
const paymentIdOf = (body: Record<string, unknown>): string => text(body.payment_id || body.transaction_id || body.operation_id || body.id) || '';
const isPaid = (body: Record<string, unknown>): boolean => {
  const allowed = optional('PRODAMUS_PAID_STATUSES', 'success,paid,completed,complete,confirmed,authorized').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  return [body.payment_status, body.status, body.state, body.operation_status, body.type].map(lower).some(value => allowed.includes(value));
};
const incomingSign = (req: any, body: Record<string, unknown>): string => text(req.headers?.['x-signature'] || req.headers?.['x-prodamus-signature'] || req.headers?.signature || req.headers?.sign || body.signature || body.sign);
const isTrusted = (req: any, body: Record<string, unknown>): boolean => {
  if (optional('PRODAMUS_REQUIRE_WEBHOOK_SIGNATURE', 'true') === 'false') return true;
  const actual = incomingSign(req, body);
  const expected = makeSignature(body as Record<string, any>, required('PRODAMUS_SECRET_KEY'));
  return Boolean(actual) && safeEqual(actual, expected);
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const body = readBody(req);
    if (!isTrusted(req, body)) return res.status(401).send('Bad signature');
    const orderId = orderIdOf(body);
    if (!orderId) return res.status(400).send('Missing order_id');
    const supabase = getAdmin();
    const paymentId = paymentIdOf(body);
    if (isPaid(body)) {
      const { error } = await supabase.rpc('activate_paid_premium_payment', { p_provider_order_id: orderId, p_provider_payment_id: paymentId, p_raw_payload: body });
      if (error) throw error;
      return res.status(200).send('OK');
    }
    await supabase.from('premium_payments').update({ status: 'ignored', provider_payment_id: paymentId || null, raw_payload: body }).eq('provider', 'prodamus').eq('provider_order_id', orderId).neq('status', 'paid');
    return res.status(200).send('OK');
  } catch (error: unknown) {
    console.error('Prodamus webhook failed', error);
    return res.status(500).send(error instanceof Error ? error.message : 'Webhook failed');
  }
}
