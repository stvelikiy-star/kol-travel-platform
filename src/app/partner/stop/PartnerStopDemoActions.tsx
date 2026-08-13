"use client";

import { useState } from "react";
import {
  emergencyStopRequestDemoAction,
  pauseFullBusinessDemoAction,
  pauseFutureOrdersDemoAction
} from "@/app/actions/partner/partnerStop";
import { DemoActionResultPanel } from "@/components/shared/DemoActionResultPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type DemoActionResult = Parameters<typeof DemoActionResultPanel>[0]["result"];

const demoReason = "Demo partner stop reason";
const plannedResumeTime = "end_of_day_demo";

export function PartnerStopDemoActions() {
  const [result, setResult] = useState<DemoActionResult>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Partner stop demo actions</CardTitle>
        <CardDescription>
          Pilot buttons pause future demand only. Accepted orders and confirmed bookings are not cancelled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm leading-6 text-foreground">
          Demo режим: кнопки показывают результат сценария, но пока не меняют реальные данные. В production-версии действия будут проверяться по ролям, RLS, audit log и подтверждению админа для high-risk операций. ALCOHOL_MODULE_ENABLED=false.
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setResult(pauseFutureOrdersDemoAction(demoReason, plannedResumeTime))}>
            Пауза новых заказов
          </Button>
          <Button variant="danger" onClick={() => setResult(pauseFullBusinessDemoAction(demoReason, plannedResumeTime))}>
            Остановить весь бизнес
          </Button>
          <Button variant="danger" onClick={() => setResult(emergencyStopRequestDemoAction("Demo emergency stop request"))}>
            Экстренная остановка
          </Button>
        </div>

        <DemoActionResultPanel result={result} title="Partner stop demo result" />
      </CardContent>
    </Card>
  );
}
