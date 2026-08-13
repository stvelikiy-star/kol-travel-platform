# ENVIRONMENT VARIABLES

## Назначение

Документ описывает environment variables для KÖL / Issyk-Kul Travel & Delivery Platform. На Stage 11B это справочник: реальные backend integrations не подключаются.

## Compliance note

Alcohol module remains OFF by default. No alcohol delivery or sales are enabled. Activation requires legal review, licensing, partner verification and admin approval. `ALCOHOL_MODULE_ENABLED=false`.

## Public app variables

### `NEXT_PUBLIC_APP_URL`

Purpose: публичный URL приложения.

Required: yes for production, optional for local demo.

Browser safe: yes.

Default: `http://localhost:3000`.

Production note: должен быть production domain.

### `NEXT_PUBLIC_SITE_URL`

Purpose: legacy/public site URL placeholder.

Required: optional.

Browser safe: yes.

Default: empty.

Production note: можно синхронизировать с `NEXT_PUBLIC_APP_URL`.

### `NEXT_PUBLIC_APP_NAME`

Purpose: display name приложения.

Required: optional.

Browser safe: yes.

Default: `KOL Travel Platform`.

Production note: можно заменить на `KÖL / Issyk-Kul Travel & Delivery Platform`.

### `NEXT_PUBLIC_DEFAULT_LOCALE`

Purpose: язык по умолчанию.

Required: optional.

Browser safe: yes.

Default: `ru`.

Production note: later добавить `ky`, `en`.

## Supabase variables

### `NEXT_PUBLIC_SUPABASE_URL`

Purpose: Supabase project URL для browser-safe client later.

Required: later.

Browser safe: yes.

Default: empty.

Production note: заполняется после создания Supabase project.

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Purpose: Supabase anon key для browser-safe client later.

Required: later.

Browser safe: yes, если RLS настроен правильно.

Default: empty.

Production note: RLS must be enabled before production data.

### `SUPABASE_URL`

Purpose: server-side legacy alias/project URL.

Required: optional if `NEXT_PUBLIC_SUPABASE_URL` exists.

Browser safe: no need to expose directly.

Default: empty.

Production note: prefer one canonical name later.

### `SUPABASE_ANON_KEY`

Purpose: server-side legacy alias for anon key.

Required: optional if `NEXT_PUBLIC_SUPABASE_ANON_KEY` exists.

Browser safe: no need to expose directly.

Default: empty.

Production note: prefer one canonical name later.

### `SUPABASE_SERVICE_ROLE_KEY`

Purpose: elevated server-only Supabase key.

Required: only for server admin operations later.

Browser safe: no. Must never be exposed to browser.

Default: empty.

Production note: store only as server secret; rotate if leaked.

### `DATABASE_URL`

Purpose: direct PostgreSQL connection for migrations/server tools later.

Required: later for migrations and admin scripts.

Browser safe: no.

Default: empty.

Production note: never expose to client; restrict access.

## Support variables

### `NEXT_PUBLIC_SUPPORT_PHONE`

Purpose: public support phone placeholder.

Required: optional.

Browser safe: yes.

Default: empty.

Production note: show only approved support contact.

### `NEXT_PUBLIC_SUPPORT_TELEGRAM`

Purpose: public Telegram support handle.

Required: optional.

Browser safe: yes.

Default: empty.

Production note: this is not bot integration.

### `NEXT_PUBLIC_SUPPORT_WHATSAPP`

Purpose: public WhatsApp support contact.

Required: optional.

Browser safe: yes.

Default: empty.

Production note: use official business contact.

## Telegram variables

### `TELEGRAM_BOT_TOKEN`

Purpose: Telegram bot token for future notifications.

Required: later.

Browser safe: no.

Default: empty.

Production note: server-only secret.

### `TELEGRAM_OWNER_CHAT_ID`

Purpose: owner/admin chat ID for future internal alerts.

Required: later.

Browser safe: no.

Default: empty.

Production note: do not expose in client.

### `TELEGRAM_ENABLE_REAL_CALLS`

Purpose: feature flag for real Telegram calls.

Required: yes as safety flag.

Browser safe: server-side preferred.

Default: `false`.

Production note: enable only after notification audit.

## n8n variables

### `N8N_WEBHOOK_URL`

Purpose: future n8n webhook endpoint.

Required: later.

Browser safe: no.

Default: empty.

Production note: server-side only.

### `N8N_ENABLE_REAL_CALLS`

Purpose: feature flag for real n8n calls.

Required: yes as safety flag.

Browser safe: server-side preferred.

Default: `false`.

Production note: enable only after workflow testing.

## Compliance and payments

### `ALCOHOL_MODULE_ENABLED`

Purpose: global alcohol module feature flag.

Required: yes.

Browser safe: server-side preferred; public derived state can be exposed later if needed.

Default: `false`.

Production note: must remain false until legal review, licensing, partner verification and admin approval.

### `PAYMENTS_ENABLED`

Purpose: global online payments feature flag.

Required: yes.

Browser safe: server-side preferred; public derived state can be exposed later if needed.

Default: `false`.

Production note: enable only after payment provider, legal setup, webhooks and refund audit are ready.
