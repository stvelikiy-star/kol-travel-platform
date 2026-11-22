# KÖL AI — Admin foundation (not an active bot)

Status: **admin preparation**, not live AI. No OpenAI, GREEN-API, Telegram
API calls, background worker, webhooks, automated messages, model training,
customer context retrieval, or transactional write tools are enabled.

Admin: `/admin/ai`, `/admin/ai/knowledge`, `/admin/ai/channels`.
Content manager: `/editor/ai` and its knowledge/channels subpages.

The KÖL content manager/superadmin can:
- save RU/KG/EN knowledge articles, precise answer scripts, partner onboarding
  instructions, escalation policies, and operational guides as drafts;
- publish or archive them, with a version record for each change;
- designate material audiences (public / client / partner / staff / admin);
- keep escalation paths and channel notes for web, WhatsApp, Telegram;
- *not* activate channels or automated replies via the UI/database, nor store tokens.

The underlying Supabase RLS restricts all records to active `super_admin`
and `content_manager` roles. No public Data API policies grant access;
future LLM retrieval needs a separate server-only scoped reader which
returns only `status=published` and an authorised audience.

The database trigger stores the previous and new versions. This admin UI
shows history but does not yet provide a restore control. Do not use these
materials as a source for live responses until the retrieval/filtering and
separate AI-connection release are implemented.

New migration: `20261122071538_kol_ai_admin_knowledge_hub_v1.sql`.
Apply **only to KÖL TEST** for initial staging. Production database remains
separate and must not be modified without the canonical baseline and release
readiness gates. Never seed fake commercial offers, prices, dates, reviews,
API keys or payment confirmations.

To later activate KÖL AI:
1. Confirm AI provider key and approved cost budget / rate limits.
2. Implement a server-only reader for published/public knowledge and existing
   approved public catalog/inventory RPCs; enforce user auth for private reads.
3. Add handoff and conversation audit, explicit consent and retention policy.
4. Connect and verify channel providers, webhook signatures and idempotency.
5. Release through a separate feature flag; do not bypass finance/booking/RBAC.
