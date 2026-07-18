import { query } from './db';

let ready: Promise<void> | null = null;

export function ensurePasswordResetSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(`
        create table if not exists public.password_reset_tokens (
          id uuid primary key default gen_random_uuid(),
          user_id uuid not null references public.app_users(id) on delete cascade,
          token_hash text not null unique,
          expires_at timestamptz not null,
          used_at timestamptz,
          created_at timestamptz not null default now()
        )
      `);
      await query(`
        create index if not exists password_reset_tokens_user_created_idx
          on public.password_reset_tokens (user_id, created_at desc)
      `);
      await query(`
        create index if not exists password_reset_tokens_active_idx
          on public.password_reset_tokens (expires_at)
          where used_at is null
      `);

      // Earlier clients could persist the chosen pet name but lose the final
      // onboarding flag during a late profile refresh. A non-default pet name
      // on an already-created Kids profile is evidence that naming completed.
      await query(`
        update public.profiles
           set pet = jsonb_set(coalesce(pet, '{}'::jsonb), '{characterOnboarded}', 'true'::jsonb, true),
               updated_at = now()
         where (role = 'parent' or account_mode = 'parent')
           and child_display_name is not null
           and btrim(child_display_name) <> ''
           and coalesce((pet ->> 'characterOnboarded')::boolean, false) = false
           and coalesce(nullif(btrim(pet ->> 'name'), ''), 'Щенок') <> 'Щенок'
      `);
    })().catch(error => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
