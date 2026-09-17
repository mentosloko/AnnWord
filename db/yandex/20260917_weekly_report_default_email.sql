-- Weekly reports are enabled by default for parent accounts and use the account email.
-- Under the previous semantics NULL also represented an explicit opt-out. If a profile
-- has a historical delivery but is NULL now, preserve that known opt-out as ''.
DO $$
BEGIN
  IF to_regclass('public.weekly_report_delivery_log') IS NOT NULL THEN
    UPDATE public.profiles p
       SET weekly_report_email = '', updated_at = now()
     WHERE p.weekly_report_email IS NULL
       AND EXISTS (
         SELECT 1
           FROM public.weekly_report_delivery_log d
          WHERE d.profile_id = p.id
       );
  END IF;
END $$;

UPDATE public.profiles p
   SET weekly_report_email = u.email,
       updated_at = now()
  FROM public.app_users u
 WHERE u.id = p.id
   AND p.weekly_report_email IS NULL
   AND (p.role = 'parent' OR p.account_mode = 'parent');
