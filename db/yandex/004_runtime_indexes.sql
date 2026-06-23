create index if not exists adult_learner_links_adult_idx
  on public.adult_learner_links(adult_user_id, created_at desc);

create index if not exists adult_learner_links_learner_idx
  on public.adult_learner_links(learner_user_id, created_at desc);

create index if not exists assigned_word_sets_adult_learner_idx
  on public.assigned_word_sets(adult_user_id, learner_user_id, created_at desc)
  where archived_at is null;

create index if not exists assigned_word_sets_learner_idx
  on public.assigned_word_sets(learner_user_id, created_at desc)
  where archived_at is null;

create index if not exists profiles_subscription_idx
  on public.profiles(subscription_tier, premium_expires_at desc);
