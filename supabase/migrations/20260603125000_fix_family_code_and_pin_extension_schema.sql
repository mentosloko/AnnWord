-- The pgcrypto functions are installed in the extensions schema in Supabase.
-- Qualify them explicitly because these SECURITY DEFINER functions restrict search_path to public.
create or replace function public.create_single_child_profile(p_child_name text, p_parent_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_name text := nullif(trim(p_child_name), '');
  v_code text;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if v_name is null or char_length(v_name) > 40 then raise exception 'Укажите имя ребёнка.'; end if;
  if coalesce(trim(p_parent_pin), '') !~ '^[0-9]{4}$' then raise exception 'PIN должен состоять из 4 цифр.'; end if;
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if v_profile.role = 'teacher' then raise exception 'Teacher account cannot create a child profile'; end if;
  if v_profile.child_display_name is not null then raise exception 'В тестовой версии доступен один ребёнок.'; end if;
  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8));
    exit when not exists (select 1 from public.profiles where upper(child_share_code) = v_code);
  end loop;
  perform set_config('annword.rc_admin_write', 'allowed', true);
  update public.profiles
     set role = 'parent',
         account_mode = 'parent',
         feature_flags = jsonb_set(coalesce(feature_flags, '{}'::jsonb), '{adultRoom}', 'true'::jsonb, true),
         child_display_name = v_name,
         child_share_code = v_code,
         parent_pin_hash = extensions.crypt(trim(p_parent_pin), extensions.gen_salt('bf')),
         child_slots_limit = 1
   where id = auth.uid();
  return jsonb_build_object('child_name', v_name, 'child_share_code', v_code, 'child_slots_limit', 1);
end;
$$;

create or replace function public.verify_parent_pin(p_pin text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hash text;
begin
  if auth.uid() is null then return false; end if;
  select parent_pin_hash into v_hash from public.profiles where id = auth.uid() and role = 'parent';
  return v_hash is not null and v_hash = extensions.crypt(coalesce(trim(p_pin), ''), v_hash);
end;
$$;

revoke execute on function public.create_single_child_profile(text, text) from public, anon;
revoke execute on function public.verify_parent_pin(text) from public, anon;
grant execute on function public.create_single_child_profile(text, text) to authenticated;
grant execute on function public.verify_parent_pin(text) to authenticated;
notify pgrst, 'reload schema';
