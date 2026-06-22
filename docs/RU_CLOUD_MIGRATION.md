# AnnWord: перенос production в российский контур

Рабочая ветка: `infra/ru-cloud-migration`

Связанная задача: GitHub issue #44 — перенос AnnWord в Yandex Cloud вместо Supabase/Vercel.

## Принятое решение

- GitHub пока остается основным репозиторием и контуром разработки.
- Production runtime и production-данные переносим в российский контур.
- Основной целевой провайдер: Yandex Cloud.
- Пользователей можно попросить установить новые пароли после миграции.
- Supabase Auth не переносим один-в-один; заменяем собственным backend-auth.

## Целевая архитектура v1

```text
React/Vite frontend
  -> Yandex Object Storage static hosting
  -> AnnWord Backend API in Yandex Serverless Containers
  -> Yandex Managed PostgreSQL
  -> Yandex Object Storage for app/user assets, if needed
  -> Prodamus payments
```

## Что создать в Yandex Cloud

### 1. Cloud/folder

Создать отдельный каталог, например:

- Cloud: текущий или новый cloud аккаунта.
- Folder: `annword-production`.

Передать разработчику:

```text
YC_CLOUD_ID=
YC_FOLDER_ID=
```

### 2. Service account для CI/CD

Создать сервисный аккаунт, например:

```text
annword-deploy-bot
```

Минимально понадобятся роли на folder/resources для:

- push/pull Docker images в Container Registry;
- обновления Serverless Container;
- загрузки frontend build в Object Storage;
- чтения production secrets, если деплой будет интегрирован с Lockbox;
- просмотра нужных ресурсов.

Передать разработчику:

```text
YC_SERVICE_ACCOUNT_ID=
YC_SERVICE_ACCOUNT_NAME=annword-deploy-bot
```

Закрытый ключ сервисного аккаунта не отправлять в GitHub и не вставлять в issue. Его нужно передать только безопасным способом или добавить напрямую в GitHub Actions Secrets.

### 3. Managed PostgreSQL

Создать кластер PostgreSQL 17, чтобы соответствовать текущему Supabase PostgreSQL 17.

Рекомендуемые имена:

```text
cluster: annword-pg-prod
database: annword
app user: annword_app
migration user: annword_migrator
```

Передать разработчику:

```text
PG_HOST=
PG_PORT=6432 or 5432
PG_DATABASE=annword
PG_APP_USER=annword_app
PG_MIGRATION_USER=annword_migrator
PG_SSLMODE=require
```

Пароли не отправлять в issue/чат. Их нужно положить в Yandex Lockbox и/или GitHub Actions Secrets.

### 4. Object Storage buckets

Создать bucket для frontend static hosting:

```text
annword-frontend-prod
```

Если в приложении используются пользовательские файлы или Supabase Storage, создать второй bucket:

```text
annword-assets-prod
```

Передать разработчику:

```text
YC_FRONTEND_BUCKET=annword-frontend-prod
YC_ASSETS_BUCKET=annword-assets-prod
YC_S3_ENDPOINT=https://storage.yandexcloud.net
```

### 5. Container Registry

Создать registry:

```text
annword-registry
```

Целевой image name:

```text
cr.yandex/<registry-id>/annword-api:<git-sha>
```

Передать разработчику:

```text
YC_REGISTRY_ID=
YC_BACKEND_IMAGE=annword-api
```

### 6. Serverless Container

Создать container для backend API:

```text
annword-api-prod
```

Передать разработчику:

```text
YC_SERVERLESS_CONTAINER_ID=
YC_API_PUBLIC_URL=
```

### 7. Lockbox secrets

Создать secret, например:

```text
annword-production-env
```

В него должны попасть production-секреты:

```text
DATABASE_URL=
SESSION_SECRET=
JWT_SECRET=
COOKIE_SECRET=
PRODAMUS_SECRET=
YANDEX_CLIENT_ID=
YANDEX_CLIENT_SECRET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

Не хранить эти значения в репозитории.

### 8. Домены и DNS

Рекомендуемая схема:

```text
app domain: annword.ru or app.annword.ru
api domain: api.annword.ru
```

Нужно будет обновить:

- DNS для frontend;
- DNS/API endpoint для backend;
- Prodamus webhook URL;
- Prodamus success/fail URLs;
- Yandex OAuth redirect URI.

Передать разработчику:

```text
APP_URL=https://...
API_URL=https://api....
```

## Какие данные нужны от владельца проекта

Можно прислать в чат только несекретные значения:

```text
YC_CLOUD_ID=
YC_FOLDER_ID=
YC_REGISTRY_ID=
YC_SERVERLESS_CONTAINER_ID=
YC_FRONTEND_BUCKET=
YC_ASSETS_BUCKET=
YC_API_PUBLIC_URL=
APP_URL=
API_URL=
PG_HOST=
PG_PORT=
PG_DATABASE=
PG_APP_USER=
PG_MIGRATION_USER=
```

Не присылать в чат:

```text
пароли PostgreSQL
service account private key
Prodamus secret
Yandex OAuth client secret
S3 secret key
JWT/session/cookie secrets
Supabase service role key
```

Их нужно добавлять в:

- GitHub Actions Secrets;
- Yandex Lockbox;
- локальный `.env.production.local`, если нужно временно тестировать вручную.

## Что будет сделано в коде

- Добавить backend DB adapter на PostgreSQL.
- Добавить собственный auth layer вместо Supabase Auth.
- Добавить API routes для профиля, игр, словарей, платежей, преподавателя.
- Перевести frontend с прямых Supabase calls на backend API.
- Добавить Dockerfile для backend.
- Добавить GitHub Actions deploy workflow в Yandex Cloud.
- Добавить env templates без секретов.
- Добавить migration scripts для Supabase -> Yandex PostgreSQL.
- Добавить smoke-test checklist.

## Миграция пользователей

Так как активных реальных пользователей мало, безопасный вариант:

1. Перенести profiles/progress/payments/dictionaries.
2. Создать учетные записи в новой auth-системе без старых паролей.
3. Отправить пользователям ссылку/инструкцию для установки нового пароля.
4. После входа пользователь видит старый профиль, прогресс и premium-статус.

## Cutover plan

1. Поднять staging в Yandex Cloud.
2. Прогнать smoke tests.
3. Согласовать короткое окно миграции.
4. Заморозить запись на старом production.
5. Снять финальный dump Supabase.
6. Restore в Yandex PostgreSQL.
7. Обновить DNS/callback/webhook URLs.
8. Проверить production smoke tests.
9. Попросить пользователей установить новые пароли.
10. Сохранить Vercel/Supabase как rollback на короткий период.
