create table if not exists public.parent_contact_preferences (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_contact_preferences_email_length check (char_length(email) <= 254)
);

create index if not exists parent_contact_preferences_email_idx
  on public.parent_contact_preferences (lower(email));
