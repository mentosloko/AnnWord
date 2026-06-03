-- Frontend reads this nullable RC field during profile bootstrap.
-- Keep it present even though weekly emails are not enabled in the public UX.
alter table public.profiles add column if not exists weekly_report_email text;
notify pgrst, 'reload schema';
