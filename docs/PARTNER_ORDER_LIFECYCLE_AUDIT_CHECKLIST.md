# Partner Order Lifecycle Post-Stage Audit Checklist

Run only after the implementation gate is green.

- [ ] direct authenticated `orders` UPDATE denied
- [ ] legacy public ready-for-pickup writer not executable
- [ ] wrong-role Client cannot call Partner order RPC
- [ ] cross-owner Partner cannot mutate another business order
- [ ] invalid transitions write no extra history/audit
- [ ] Food browser checkout ignores browser price and uses DB total
- [ ] Shop browser checkout decrements stock exactly once
- [ ] pickup creates no `deliveries` row
- [ ] Partner sees scoped item snapshots
- [ ] Food and Shop happy paths reach `ready_for_pickup`
- [ ] payment status remains unchanged through Partner lifecycle
- [ ] issue/cancellation request are audit-only
- [ ] Shop reject fails closed and stock remains unchanged
- [ ] committed transition replay is idempotent
- [ ] full existing Local staging smoke still passes
- [ ] Public/Visual/CI have no regressions
