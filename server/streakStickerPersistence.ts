import { query } from './db';

export const STREAK_STICKER_RECONCILIATION_SQL = `
with profile_stickers as (
  select p.id,
         case when jsonb_typeof(p.pet) = 'object' then p.pet else '{}'::jsonb end as pet_obj,
         case
           when coalesce(p.pet->>'dailyStreak', '') ~ '^[0-9]+$' then (p.pet->>'dailyStreak')::integer
           else 0
         end as daily_streak,
         lower(trim(coalesce(p.username, ''))) = 'anna.a.manto' as grant_anna_stickers
    from public.profiles p
), desired_stickers as (
  select profile_stickers.id,
         profile_stickers.pet_obj,
         (
           select coalesce(jsonb_agg(sticker_id order by sticker_id), '[]'::jsonb)
             from (
               select distinct sticker_id
                 from (
                   select jsonb_array_elements_text(
                     case
                       when jsonb_typeof(profile_stickers.pet_obj->'earnedStickerIds') = 'array'
                         then profile_stickers.pet_obj->'earnedStickerIds'
                       else '[]'::jsonb
                     end
                   ) as sticker_id
                   union all select 'streak_1' where profile_stickers.daily_streak >= 1 or profile_stickers.grant_anna_stickers
                   union all select 'streak_3' where profile_stickers.daily_streak >= 3 or profile_stickers.grant_anna_stickers
                   union all select 'streak_7' where profile_stickers.daily_streak >= 7
                   union all select 'streak_14' where profile_stickers.daily_streak >= 14
                   union all select 'streak_30' where profile_stickers.daily_streak >= 30
                 ) sticker_candidates
                where sticker_id <> ''
             ) unique_stickers
         ) as earned_sticker_ids
    from profile_stickers
)
update public.profiles p
   set pet = jsonb_set(desired_stickers.pet_obj, '{earnedStickerIds}', desired_stickers.earned_sticker_ids, true),
       updated_at = now()
  from desired_stickers
 where p.id = desired_stickers.id
   and (
     case
       when jsonb_typeof(desired_stickers.pet_obj->'earnedStickerIds') = 'array'
         then desired_stickers.pet_obj->'earnedStickerIds'
       else '[]'::jsonb
     end
   ) is distinct from desired_stickers.earned_sticker_ids
`;

export async function reconcilePersistedStreakStickers(): Promise<number> {
  const result = await query(STREAK_STICKER_RECONCILIATION_SQL);
  const updatedProfiles = result.rowCount || 0;
  console.log('Persisted streak stickers reconciled', { updatedProfiles });
  return updatedProfiles;
}
