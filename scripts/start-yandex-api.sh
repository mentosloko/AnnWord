#!/bin/sh
set -u

mkdir -p /tmp/annword
rm -f /tmp/annword/migration-error.log

if [ "${YANDEX_AUTO_MIGRATE:-true}" != "false" ]; then
  echo "Running Yandex PostgreSQL migrations before API start..."
  if ! npm run db:yandex:migrate 2>&1 | tee /tmp/annword/migration-error.log; then
    echo "Yandex PostgreSQL migrations failed. API will still start for diagnostics."
  else
    rm -f /tmp/annword/migration-error.log
  fi
else
  echo "YANDEX_AUTO_MIGRATE=false; skipping Yandex PostgreSQL migrations."
fi

exec npm run api:start
