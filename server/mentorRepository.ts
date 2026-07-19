import { query } from './db';

export type ManagedLearnerRow = {
  id: string;
  name: string;
  class_label: string | null;
  child_share_code: string | null;
  stats: unknown;
  last_assigned_at: Date | string | null;
  assigned_words: string[];
};

export async function loadManagedLearners(userId: string): Promise<ManagedLearnerRow[]> {
  const result = await query<ManagedLearnerRow>(
    `with linked_learners as (
       select p.id,
              coalesce(p.child_display_name, p.username, 'Ученик') as name,
              l.class_label,
              p.child_share_code,
              p.stats,
              latest_set.created_at as last_assigned_at,
              coalesce(latest_set.words, '{}'::text[]) as assigned_words
         from adult_learner_links l
         join profiles p on p.id = l.learner_user_id
         left join lateral (
           select s.words, s.created_at
             from assigned_word_sets s
            where s.adult_user_id = l.adult_user_id
              and s.learner_user_id = l.learner_user_id
              and s.archived_at is null
            order by s.created_at desc
            limit 1
         ) latest_set on true
        where l.adult_user_id = $1
     ), self_child as (
       select p.id,
              coalesce(p.child_display_name, p.username, 'Ребёнок') as name,
              null::text as class_label,
              p.child_share_code,
              p.stats,
              latest_set.created_at as last_assigned_at,
              coalesce(latest_set.words, '{}'::text[]) as assigned_words
         from profiles p
         left join lateral (
           select s.words, s.created_at
             from assigned_word_sets s
            where s.learner_user_id = p.id
              and s.archived_at is null
            order by s.created_at desc
            limit 1
         ) latest_set on true
        where p.id = $1
          and p.account_mode = 'parent'
          and p.child_display_name is not null
     )
     select * from linked_learners
     union all
     select * from self_child
      where not exists (select 1 from linked_learners where linked_learners.id = self_child.id)
     order by name`,
    [userId],
  );
  return result.rows;
}
