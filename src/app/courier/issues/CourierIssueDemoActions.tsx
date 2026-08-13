"use client";

import { useState } from "react";
import {
  reportAddressProblemDemoAction,
  reportClientNotAnsweringDemoAction,
  reportPartnerNotReadyDemoAction,
  requestAdminSupportDemoAction
} from "@/app/actions/courier/courierIssues";
import { DemoActionResultPanel } from "@/components/shared/DemoActionResultPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type DemoActionResult = Parameters<typeof DemoActionResultPanel>[0]["result"];

const demoDeliveryId = "demo-courier-issue-1";
const demoReason = "Demo reason from courier cabinet";

export function CourierIssueDemoActions() {
  const [result, setResult] = useState<DemoActionResult>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo issue actions</CardTitle>
        <CardDescription>
          Pilot issue buttons return demo results only. No ticket or delivery status is changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm leading-6 text-foreground">
          Demo режим: кнопки показывают результат сценария, но пока не меняют реальные данные. В production-версии действия будут проверяться по ролям, RLS, audit log и подтверждению админа для high-risk операций. ALCOHOL_MODULE_ENABLED=false.
        </div>

        <Button className="w-full" variant="outline" onClick={() => setResult(reportPartnerNotReadyDemoAction(demoDeliveryId, demoReason))}>
          Партнёр не готов
        </Button>
        <Button className="w-full" variant="outline" onClick={() => setResult(reportClientNotAnsweringDemoAction(demoDeliveryId, demoReason))}>
          Клиент не отвечает
        </Button>
        <Button className="w-full" variant="secondary" onClick={() => setResult(reportAddressProblemDemoAction(demoDeliveryId, demoReason))}>
          Проблема с адресом
        </Button>
        <Button className="w-full" variant="danger" onClick={() => setResult(requestAdminSupportDemoAction(demoDeliveryId, "Demo courier issue"))}>
          Нужен админ
        </Button>

        <DemoActionResultPanel result={result} title="Courier issue demo result" />
      </CardContent>
    </Card>
  );
}
