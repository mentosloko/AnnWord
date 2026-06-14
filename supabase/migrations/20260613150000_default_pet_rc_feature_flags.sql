-- Backend defaults must match frontend profile defaults for pet RC features.

create or replace function public.rc_feature_enabled(p_user_id uuid, p_feature text)
returns boolean language sql security definer set search_path = public stable as $$
  select case
    when p_feature in ('dailyWorldReward','treatRequests','streakStickers','levelWardrobe') then coalesce((feature_flags->>p_feature)::boolean, true)
    else coalesce((feature_flags->>p_feature)::boolean, false)
  end
  from public.profiles where id = p_user_id;
$$;

notify pgrst, 'reload schema';
