# Supabase to Yandex PostgreSQL data migration runbook

This runbook covers data migration only. It assumes the Yandex PostgreSQL schema from `db/yandex/*.sql` has already been applied.

## Principle

Supabase production uses:

```text
Supabase Auth identity -> public.profiles
```

Yandex production uses:

```text
public.app_users -> public.profiles
```

Because old Supabase Auth credentials are not migrated, existing real users will set a new account secret after cutover.

## Tables to migrate first

Priority order:

```text
profiles
premium_payments
adult_learner_links
assigned_word_sets
prodamus_webhook_events, optional
```

## Export from Supabase

Use Supabase SQL editor, `psql`, or dashboard export.

Recommended exports:

```sql
select * from public.profiles;
select * from public.premium_payments;
select * from public.adult_learner_links;
select * from public.assigned_word_sets;
```

Use CSV or JSON. Keep the raw export outside the repository.

## Create app users in Yandex

For each migrated profile, create one `app_users` row with the same UUID as `profiles.id`.

For active real users, use their real email address.

For old test/guest rows, either skip them or create local placeholder identities and mark them as requiring reset.

Required values:

```text
id: same UUID as profile id
email: real email for active users
provider: email
email_confirmed_at: current timestamp
password_reset_required: true for migrated users
```

The actual account secret must be set after migration. Do not copy Supabase Auth hashes into Yandex PostgreSQL.

## Import profiles

When importing `profiles`, keep these fields if present:

```text
id
username
role
account_mode
subscription_tier
premium_expires_at
feature_flags
dictionary_collections
weekly_report_email
child_display_name
child_share_code
child_slots_limit
custom_dictionary_en
stats
pet
coins
inventory
created_at
updated_at
```

If a source column is missing, let Yandex PostgreSQL defaults fill it.

## Premium preservation

For every active paid user, verify after import:

```sql
select id, subscription_tier, premium_expires_at, feature_flags
from public.profiles
where subscription_tier = 'premium';
```

Expected:

```text
subscription_tier = premium
premium_expires_at is in the future
feature_flags contains premiumDictionaries and adultRoom when appropriate
```

## Parent/teacher links

After importing links, verify:

```sql
select adult_user_id, learner_user_id, relation_role
from public.adult_learner_links;
```

The v1 scenario uses child share codes generated in the parent account. Teachers add that code in their account.

## Validation queries

Run after import:

```sql
select count(*) from public.app_users;
select count(*) from public.profiles;
select count(*) from public.premium_payments;
select count(*) from public.adult_learner_links;
select count(*) from public.assigned_word_sets;
```

Check orphan profiles:

```sql
select p.id
from public.profiles p
left join public.app_users u on u.id = p.id
where u.id is null;
```

Expected: zero rows.

Check negative coins:

```sql
select id, coins
from public.profiles
where coins < 0;
```

Expected: zero rows.

## Cutover note

Only after data import and smoke checks:

1. Point frontend to Yandex-hosted API.
2. Ask the two active real users to set new account secrets.
3. Verify that old progress, premium, inventory and dictionary state are visible.
4. Keep Supabase/Vercel available for rollback during the migration window.
