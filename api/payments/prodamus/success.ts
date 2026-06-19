import { createClient } from '@supabase/supabase-js';

const serviceKeyName = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
const env = (name: string, fallback = '') => process.env[name] || fallback;
const required = (name: string): string => { const value = process.env[name]; if (!value) throw new Error(`${name} is not configured`); return value; };
const appUrl = () => env('PRODAMUS_APP_URL', env('APP_URL', 'https://ann-word.vercel.app')).replace(/\/+$/, '');
const admin = () => createClient(required('VITE_SUPABASE_URL'), required(serviceKeyName), { auth: { persistSession: false, autoRefreshToken: false } });
const text = (value: unknown): string => String(value || '').trim();
const queryValue = (value: unknown): string => Array.isArray(value) ? text(value[0]) : text(value);

const redirectToApp = (res: any, params: Record<string, string>) => {
  const url = new URL(appUrl());
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  res.statusCode = 302;
  res.setHeader('Location', url.toString());
  res.end();
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const orderId = queryValue(req.query?.order_id || req.query?.orderId || req.query?.order_num || req.query?.order);
  if (!orderId) return redirectToApp(res, { payment: 'error', reason: 'missing_order_id' });

  const supabase = admin();
  try {
    const { data: payment, error: paymentError } = await supabase
      .from('premium_payments')
      .select('provider_order_id,status,raw_payload')
      .eq('provider', 'prodamus')
      .eq('provider_order_id', orderId)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) return redirectToApp(res, { payment: 'error', reason: 'order_not_found' });

    const checkout = (payment.raw_payload && typeof payment.raw_payload === 'object' && 'checkout' in payment.raw_payload)
      ? (payment.raw_payload as any).checkout
      : null;
    const isDemoOrder = checkout?.demo_mode === '1' || checkout?.demo_mode === 1 || checkout?.demo_mode === true || (payment.raw_payload as any)?.demo_mode === true;

    if (!isDemoOrder) return redirectToApp(res, { payment: 'pending', order_id: orderId });

    if (payment.status !== 'paid') {
      const { error: activationError } = await supabase.rpc('activate_paid_premium_payment', {
        p_provider_order_id: orderId,
        p_provider_payment_id: null,
        p_raw_payload: { source: 'demo_success_redirect', order_id: orderId },
      });
      if (activationError) throw activationError;
    }

    await supabase.from('prodamus_webhook_events').insert({
      provider_order_id: orderId,
      status: 'demo_success_redirect',
      signature_valid: null,
      is_paid: true,
      raw_payload: { query: req.query || {}, source: 'success_redirect' },
    }).then(({ error }) => { if (error) console.error('Failed to log Prodamus success redirect', error); });

    return redirectToApp(res, { payment: 'success', order_id: orderId });
  } catch (error: unknown) {
    console.error('Prodamus success redirect failed', error);
    await supabase.from('prodamus_webhook_events').insert({
      provider_order_id: orderId,
      status: 'demo_success_error',
      signature_valid: null,
      is_paid: null,
      error: error instanceof Error ? error.message : 'Success redirect failed',
      raw_payload: { query: req.query || {}, source: 'success_redirect' },
    }).then(({ error: logError }) => { if (logError) console.error('Failed to log Prodamus success redirect error', logError); });
    return redirectToApp(res, { payment: 'error', reason: 'activation_failed', order_id: orderId });
  }
}
