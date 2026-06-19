import { createClient } from '@supabase/supabase-js';
import { getPlan } from '../../_lib/premiumPlans';
import { appOrigin, payformOrigin, required } from '../../_lib/serverEnv';
import { makeSignature } from '../../_lib/prodamusSign';
import { toQuery } from '../../_lib/queryString';

const serviceKeyName = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
const getAdmin = () => createClient(required('VITE_SUPABASE_URL'), required(serviceKeyName), { auth: { persistSession: false, autoRefreshToken: false } });
const getToken = (header: unknown): string | null => typeof header === 'string' ? header.replace(/^Bearer\s+/i, '').trim() || null : null;
const readBody = (req: any): Record<string, unknown> => typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = readBody(req);
    const plan = getPlan(body.planCode);
    if (!plan) return res.status(400).json({ error: 'Unknown Premium plan' });

    const token = getToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getAdmin();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return res.status(401).json({ error: 'Unauthorized' });

    const user = userData.user;
    const orderId = `annword_${plan.code}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const origin = appOrigin();
    const email = user.email || '';

    const payformPayload: Record<string, any> = {
      order_id: orderId,
      customer_email: email,
      products: [{ name: plan.title, price: plan.amountRub, quantity: 1 }],
      urlSuccess: `${origin}/payment/success?order_id=${encodeURIComponent(orderId)}`,
      urlReturn: `${origin}/payment/fail?order_id=${encodeURIComponent(orderId)}`,
      urlNotification: `${origin}/api/payments/prodamus/webhook`,
      sys: 'annword',
      currency: 'rub',
    };

    payformPayload.signature = makeSignature(payformPayload, required('PRODAMUS_SECRET_KEY'));
    const checkoutUrl = `${payformOrigin()}/?${toQuery(payformPayload)}`;

    const { error: insertError } = await supabase.from('premium_payments').insert({
      user_id: user.id,
      provider: 'prodamus',
      provider_order_id: orderId,
      plan_code: plan.code,
      period_days: plan.periodDays,
      amount_rub: plan.amountRub,
      currency: 'RUB',
      status: 'pending',
      checkout_url: checkoutUrl,
      customer_email: email,
      raw_payload: { checkout: payformPayload },
    });

    if (insertError) throw insertError;
    return res.status(200).json({ orderId, checkoutUrl, plan: { code: plan.code, amountRub: plan.amountRub, periodDays: plan.periodDays } });
  } catch (error: unknown) {
    console.error('Prodamus create payment failed', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Payment creation failed' });
  }
}
