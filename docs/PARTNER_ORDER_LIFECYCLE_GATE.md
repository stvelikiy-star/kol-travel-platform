# KÖL Partner Order Lifecycle Gate

This branch must not merge until the exact current head passes:

1. KOL CI
2. KOL Public Flows
3. KOL Visual QA
4. KOL Local Supabase Staging Smoke, including `partner-order-runtime`
5. repeated Local Supabase workflow on the same exact SHA

No live Supabase restore/apply, payment provider activation, production deployment or delivery-fee invention is part of this gate.
