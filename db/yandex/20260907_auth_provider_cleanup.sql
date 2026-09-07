-- Normalize any historical auth-provider marker before restricting the active values.
-- Password-reset state and credentials are intentionally left untouched.
update public.app_users
set provider = case
  when yandex_id is not null then 'yandex'
  else 'email'
end,
updated_at = now()
where provider not in ('email', 'yandex');

alter table public.app_users
  drop constraint if exists app_users_provider_check;

alter table public.app_users
  add constraint app_users_provider_check
  check (provider in ('email', 'yandex'));
