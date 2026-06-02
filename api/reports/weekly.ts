type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (statusCode: number) => VercelResponse;
  json: (body: unknown) => void;
};

interface OutboxRow {
  id: string;
  email: string;
  payload: {
    learner_name?: string;
    games_played?: number;
    accuracy?: number;
    difficult_words?: string[];
    learned_words?: string[];
    week_label?: string;
  };
}

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const listText = (words: string[] | undefined): string => words?.length
  ? words.map(word => escapeHtml(word)).join(', ')
  : '—';

const buildReportHtml = (row: OutboxRow): string => {
  const payload = row.payload || {};
  const learner = escapeHtml(payload.learner_name || 'ребёнок');
  const week = escapeHtml(payload.week_label || 'прошедшую неделю');
  const games = Number(payload.games_played || 0);
  const accuracy = Number(payload.accuracy || 0);
  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#18214b">
      <h1 style="font-size:24px;margin-bottom:8px">Еженедельный отчёт AnnWord</h1>
      <p style="color:#64748b">Прогресс: ${learner} · ${week}</p>
      <div style="display:flex;gap:12px;margin:24px 0">
        <div style="padding:16px;background:#eef2ff;border-radius:16px"><strong>${games}</strong><br/>игр сыграно</div>
        <div style="padding:16px;background:#ecfdf5;border-radius:16px"><strong>${accuracy}%</strong><br/>точность</div>
      </div>
      <p><strong>Получается лучше:</strong> ${listText(payload.learned_words)}</p>
      <p><strong>Стоит повторить:</strong> ${listText(payload.difficult_words)}</p>
      <p style="margin-top:28px;color:#64748b;font-size:13px">Отчёт сформирован для родителя или преподавателя в AnnWord.</p>
    </div>`;
};

const sendMail = async (row: OutboxRow): Promise<void> => {
  const apiKey = requiredEnv('RESEND_API_KEY');
  const from = requiredEnv('WEEKLY_REPORT_FROM_EMAIL');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [row.email],
      subject: 'Еженедельный отчёт AnnWord',
      html: buildReportHtml(row),
    }),
  });
  if (!response.ok) {
    throw new Error(`Mail provider returned ${response.status}`);
  }
};

const supabaseRequest = async (path: string, init?: RequestInit): Promise<Response> => {
  const projectUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${projectUrl.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init?.headers || {}),
    },
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const authHeader = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const secret = process.env.WEEKLY_REPORT_CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const pendingResponse = await supabaseRequest('weekly_report_outbox?status=eq.pending&select=id,email,payload&limit=100');
    if (!pendingResponse.ok) throw new Error(`Unable to load outbox: ${pendingResponse.status}`);
    const pendingRows = await pendingResponse.json() as OutboxRow[];
    let sent = 0;
    const failed: string[] = [];

    for (const row of pendingRows) {
      try {
        await sendMail(row);
        await supabaseRequest(`weekly_report_outbox?id=eq.${encodeURIComponent(row.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }),
        });
        sent += 1;
      } catch {
        failed.push(row.id);
        await supabaseRequest(`weekly_report_outbox?id=eq.${encodeURIComponent(row.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'failed' }),
        });
      }
    }

    res.status(200).json({ processed: pendingRows.length, sent, failed });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
