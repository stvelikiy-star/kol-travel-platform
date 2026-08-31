# Partner Order Lifecycle Browser/DB Test Scope

The isolated local runtime must prove:

- real Client Food checkout;
- real Client Shop checkout;
- browser price tampering ignored by DB authority;
- pickup-only order delivery contract;
- direct DML denial;
- legacy write endpoint denial;
- wrong-role and cross-owner denial;
- invalid transition rollback;
- Shop reject/restock fail-closed;
- Partner scoped item read;
- Food/Shop accept -> preparing -> ready browser path;
- exact history/audit actor evidence;
- payment invariants;
- issue/cancellation-request audit-only behavior;
- committed transition idempotency.
