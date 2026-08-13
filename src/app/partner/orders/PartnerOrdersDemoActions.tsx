"use client";

import { useState } from "react";
import {
  acceptPartnerOrderDemoAction,
  markOrderReadyForPickupDemoAction,
  reportPartnerOrderIssueDemoAction
} from "@/app/actions/partner/partnerOrders";
import { DemoActionResultPanel } from "@/components/shared/DemoActionResultPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type DemoActionResult = Parameters<typeof DemoActionResultPanel>[0]["result"];

const demoOrderId = "demo-order-1";
const demoReason = "Demo partner order issue";

export function PartnerOrdersDemoActions() {
  const [result, setResult] = useState<DemoActionResult>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Partner order demo actions</CardTitle>
        <CardDescription>
          Pilot buttons call demo actions only. No order status, payment or refund is changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm leading-6 text-foreground">
          Demo режим: кнопки показывают результат сценария, но пока не меняют реальные данные. В production-версии действия будут проверяться по ролям, RLS, audit log и подтверждению админа для high-risk операций. ALCOHOL_MODULE_ENABLED=false.
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setResult(acceptPartnerOrderDemoAction(demoOrderId))}>
            Принять заказ
          </Button>
          <Button variant="secondary" onClick={() => setResult(markOrderReadyForPickupDemoAction(demoOrderId))}>
            Готов к выдаче
          </Button>
          <Button variant="outline" onClick={() => setResult(reportPartnerOrderIssueDemoAction(demoOrderId, demoReason))}>
            Сообщить проблему
          </Button>
        </div>

        <DemoActionResultPanel result={result} title="Partner order demo result" />
      </CardContent>
    </Card>
  );
}
