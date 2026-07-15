import { query } from './db';

export async function ensureWeeklyReportSchema(): Promise<void> {
  await query(`
    create table if not exists public.weekly_report_delivery_log (
      profile_id uuid not null references public.profiles(id) on delete cascade,
      week_key text not null,
      email text not null,
      status text not null check (status in ('processing', 'sent', 'failed')),
      provider_message_id text,
      error text,
      attempted_at timestamptz not null default now(),
      sent_at timestamptz,
      updated_at timestamptz not null default now(),
      primary key (profile_id, week_key)
    )
  `);

  await query(`
    create index if not exists weekly_report_delivery_status_idx
      on public.weekly_report_delivery_log (status, updated_at desc)
  `);
}
