-- Launch v1 contract:
-- one active premium seat covers one child profile.
-- second and next children must be added from the parent cabinet after buying another premium seat.

create or replace function public.create_single_child_profile(p_child_name text, p_parent_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_name text := nullif(trim(p_child_name), '');
  v_code text;
begin
  if auth.uid() is null then raise