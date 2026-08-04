const crypto = require('node:crypto');
const { Pool } = require('pg');

const EXPECTED_KEEP_COUNT = 3;
const expectedHashes = new Set(
  String(process.env.KEEP_EMAIL_HASHES || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean),
);

const normalizeConnectionString = (value) => {
  const url = new URL(value);
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  return url.toString();
};

const hashEmail = (value) =>
  crypto.createHash('sha256').update(String(value || '').trim().toLowerCase()).digest('hex');

const qi = (value) => `"${String(value).replace(/"/g, '""')}"`;
const tableSql = (name) => `public.${qi(name)}`;
const isTextType = (column) =>
  ['text', 'character varying', 'character', 'citext'].includes(String(column.data_type || '').toLowerCase())
  || String(column.udt_name || '').toLowerCase() === 'citext';
const isUserReference = (name) => {
  const value = String(name || '').toLowerCase();
  return value === 'user_id' || value.endsWith('_user_id') || value === 'profile_id';
};
const isEmailColumn = (column) => {
  if (!isTextType(column)) return false;
  const name = String(column.column_name || '').toLowerCase();
  if (!name.includes('email')) return false;
  return !['from_email', 'sender_email', 'reply_to_email'].includes(name);
};

const relationExists = async (client, name) => {
  const result = await client.query('select to_regclass($1) as relation', [`public.${name}`]);
  return Boolean(result.rows[0] && result.rows[0].relation);
};

const addDeleted = (report, table, count, phase) => {
  if (!count) return;
  report.deleted_rows_total += count;
  if (!report.deleted_by_table[table]) report.deleted_by_table[table] = { total: 0, phases: {} };
  report.deleted_by_table[table].total += count;
  report.deleted_by_table[table].phases[phase] =
    (report.deleted_by_table[table].phases[phase] || 0) + count;
};

exports.handler = async function () {
  const pool = new Pool({
    connectionString: normalizeConnectionString(process.env.DATABASE_URL || ''),
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 10000,
    statement_timeout: 120000,
  });

  const client = await pool.connect();
  const report = {
    started_at: new Date().toISOString(),
    keep_count: 0,
    users_before: 0,
    users_removed: 0,
    users_after: 0,
    profiles_after: 0,
    deleted_rows_total: 0,
    deleted_by_table: {},
    verification: {},
  };

  try {
    if (expectedHashes.size !== EXPECTED_KEEP_COUNT) {
      throw new Error(`Expected ${EXPECTED_KEEP_COUNT} keep-email hashes, received ${expectedHashes.size}.`);
    }

    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtext('annword-user-purge-20260804'))");
    await client.query('lock table public.app_users in access exclusive mode');

    const allUsersResult = await client.query(
      'select id::text as id, lower(trim(email)) as email from public.app_users order by lower(trim(email))',
    );
    report.users_before = allUsersResult.rowCount;
    const keepUsers = allUsersResult.rows.filter(row => expectedHashes.has(hashEmail(row.email)));
    const matchedHashes = new Set(keepUsers.map(row => hashEmail(row.email)));
    const missingHashes = [...expectedHashes].filter(value => !matchedHashes.has(value));

    if (keepUsers.length !== EXPECTED_KEEP_COUNT || missingHashes.length) {
      throw new Error(
        `Safety check failed: matched keep users=${keepUsers.length}, missing hashes=${missingHashes.length}.`,
      );
    }

    const purgeUsers = allUsersResult.rows.filter(row => !matchedHashes.has(hashEmail(row.email)));
    if (purgeUsers.length !== allUsersResult.rowCount - EXPECTED_KEEP_COUNT) {
      throw new Error('Safety check failed while building purge set.');
    }

    report.keep_count = keepUsers.length;
    report.users_removed = purgeUsers.length;

    await client.query(
      'create temporary table keep_users (id uuid primary key, email text not null unique) on commit drop',
    );
    await client.query(
      'create temporary table purge_users (id uuid primary key, email text not null unique) on commit drop',
    );

    for (const row of keepUsers) {
      await client.query('insert into keep_users(id, email) values ($1::uuid, $2)', [row.id, row.email]);
    }
    for (const row of purgeUsers) {
      await client.query('insert into purge_users(id, email) values ($1::uuid, $2)', [row.id, row.email]);
    }

    await client.query(
      'create temporary table keep_payment_keys (provider_order_id text, provider_payment_id text) on commit drop',
    );
    if (await relationExists(client, 'premium_payments')) {
      await client.query(`
        insert into keep_payment_keys(provider_order_id, provider_payment_id)
        select provider_order_id, provider_payment_id
          from public.premium_payments
         where user_id in (select id from keep_users)
      `);
    }

    const columnsResult = await client.query(`
      select
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        c.ordinal_position
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema
       and t.table_name = c.table_name
     where c.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
     order by c.table_name, c.ordinal_position
    `);

    const columnsByTable = new Map();
    for (const column of columnsResult.rows) {
      if (!columnsByTable.has(column.table_name)) columnsByTable.set(column.table_name, []);
      columnsByTable.get(column.table_name).push(column);
    }

    const protectedTables = new Set(['app_users', 'profiles']);
    const migrationTables = new Set(['schema_migrations', 'supabase_migrations']);

    for (const [table, columns] of columnsByTable) {
      if (protectedTables.has(table)) continue;
      const userColumns = columns.filter(column => isUserReference(column.column_name));
      if (!userColumns.length) continue;

      const invalidConditions = userColumns.map(column => {
        const name = qi(column.column_name);
        return `(${name} is not null and ${name}::text not in (select id::text from keep_users))`;
      });
      if (table === 'analytics_events' && userColumns.some(column => column.column_name === 'user_id')) {
        invalidConditions.push(`${qi('user_id')} is null`);
      }

      const result = await client.query(
        `delete from ${tableSql(table)} where ${invalidConditions.join(' or ')}`,
      );
      addDeleted(report, table, result.rowCount, 'non_keep_user_reference');
    }

    for (const [table, columns] of columnsByTable) {
      if (protectedTables.has(table) || table === 'prodamus_webhook_events') continue;
      const userColumns = columns.filter(column => isUserReference(column.column_name));
      if (userColumns.length) continue;
      const emailColumns = columns.filter(isEmailColumn);
      if (!emailColumns.length) continue;

      const invalidConditions = emailColumns.map(column => {
        const name = qi(column.column_name);
        return `(
          ${name} is not null
          and btrim(${name}::text) <> ''
          and lower(btrim(${name}::text)) not in (select email from keep_users)
        )`;
      });

      const result = await client.query(
        `delete from ${tableSql(table)} where ${invalidConditions.join(' or ')}`,
      );
      addDeleted(report, table, result.rowCount, 'non_keep_email');
    }

    if (await relationExists(client, 'prodamus_webhook_events')) {
      const webhookColumns = columnsByTable.get('prodamus_webhook_events') || [];
      const hasOrderId = webhookColumns.some(column => column.column_name === 'provider_order_id');
      const hasPaymentId = webhookColumns.some(column => column.column_name === 'provider_payment_id');
      const matches = [];
      if (hasOrderId) {
        matches.push(
          `(w.provider_order_id is not null and exists (
            select 1 from keep_payment_keys k
             where k.provider_order_id is not null
               and k.provider_order_id = w.provider_order_id
          ))`,
        );
      }
      if (hasPaymentId) {
        matches.push(
          `(w.provider_payment_id is not null and exists (
            select 1 from keep_payment_keys k
             where k.provider_payment_id is not null
               and k.provider_payment_id = w.provider_payment_id
          ))`,
        );
      }
      const keepCondition = matches.length ? matches.join(' or ') : 'false';
      const result = await client.query(
        `delete from public.prodamus_webhook_events w where not (${keepCondition})`,
      );
      addDeleted(report, 'prodamus_webhook_events', result.rowCount, 'non_keep_payment_webhook');
    }

    const appUsersDelete = await client.query(
      'delete from public.app_users where id not in (select id from keep_users)',
    );
    addDeleted(report, 'app_users', appUsersDelete.rowCount, 'account_delete');

    for (const [table] of columnsByTable) {
      if (protectedTables.has(table) || migrationTables.has(table)) continue;
      const result = await client.query(`
        delete from ${tableSql(table)} t
         where exists (
           select 1
             from purge_users p
            where to_jsonb(t)::text ilike ('%' || p.id::text || '%')
               or lower(to_jsonb(t)::text) like ('%' || lower(p.email) || '%')
         )
      `);
      addDeleted(report, table, result.rowCount, 'identifier_sweep');
    }

    const finalUsers = await client.query(
      'select id::text as id, lower(trim(email)) as email from public.app_users order by lower(trim(email))',
    );
    const finalHashes = new Set(finalUsers.rows.map(row => hashEmail(row.email)));
    const unexpectedHashes = [...finalHashes].filter(value => !expectedHashes.has(value));
    const missingFinalHashes = [...expectedHashes].filter(value => !finalHashes.has(value));
    report.users_after = finalUsers.rowCount;

    if (
      finalUsers.rowCount !== EXPECTED_KEEP_COUNT
      || unexpectedHashes.length
      || missingFinalHashes.length
    ) {
      throw new Error(
        `Final user verification failed: count=${finalUsers.rowCount}, unexpected=${unexpectedHashes.length}, missing=${missingFinalHashes.length}.`,
      );
    }

    const profilesResult = await client.query(`
      select
        count(*)::int as total,
        count(*) filter (where id not in (select id from keep_users))::int as invalid
      from public.profiles
    `);
    report.profiles_after = Number(profilesResult.rows[0]?.total || 0);
    if (
      Number(profilesResult.rows[0]?.invalid || 0) !== 0
      || report.profiles_after !== EXPECTED_KEEP_COUNT
    ) {
      throw new Error(
        `Profile verification failed: total=${report.profiles_after}, invalid=${profilesResult.rows[0]?.invalid || 0}.`,
      );
    }

    const invalidReferenceRows = [];
    for (const [table, columns] of columnsByTable) {
      if (table === 'app_users' || table === 'profiles') continue;
      const userColumns = columns.filter(column => isUserReference(column.column_name));
      if (!userColumns.length) continue;
      const invalidConditions = userColumns.map(column => {
        const name = qi(column.column_name);
        return `(${name} is not null and ${name}::text not in (select id::text from keep_users))`;
      });
      if (table === 'analytics_events' && userColumns.some(column => column.column_name === 'user_id')) {
        invalidConditions.push(`${qi('user_id')} is null`);
      }
      const result = await client.query(
        `select count(*)::int as count from ${tableSql(table)} where ${invalidConditions.join(' or ')}`,
      );
      const count = Number(result.rows[0]?.count || 0);
      if (count) invalidReferenceRows.push({ table, count });
    }

    const remainingIdentifierRows = [];
    for (const [table] of columnsByTable) {
      if (migrationTables.has(table)) continue;
      const result = await client.query(`
        select count(*)::int as count
          from ${tableSql(table)} t
         where exists (
           select 1
             from purge_users p
            where to_jsonb(t)::text ilike ('%' || p.id::text || '%')
               or lower(to_jsonb(t)::text) like ('%' || lower(p.email) || '%')
         )
      `);
      const count = Number(result.rows[0]?.count || 0);
      if (count) remainingIdentifierRows.push({ table, count });
    }

    report.verification = {
      invalid_reference_rows: invalidReferenceRows,
      remaining_identifier_rows: remainingIdentifierRows,
    };

    if (invalidReferenceRows.length || remainingIdentifierRows.length) {
      throw new Error(
        `Residual trace verification failed: references=${invalidReferenceRows.length}, identifiers=${remainingIdentifierRows.length}.`,
      );
    }

    await client.query('commit');
    report.completed_at = new Date().toISOString();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, report }),
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'purge_failed',
        report,
      }),
    };
  } finally {
    client.release();
    await pool.end().catch(() => undefined);
  }
};
