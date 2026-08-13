"use client";

import { useState } from "react";
import {
  assignCourierDemoAction,
  forceCloseDeliveryIssueRequestDemoAction,
  forceCompleteOrderRequestDemoAction,
  reassignCourierAfterPickupDemoAction
} from "@/app/actions/admin/adminDelivery";
import { createDemoActionResult } from "@/app/actions/shared/action-result";
import { DemoActionResultPanel } from "@/components/shared/DemoActionResultPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type DemoActionResult = Parameters<typeof DemoActionResultPanel>[0]["result"];

const demoOrderId = "demo-order-1";
const demoDeliveryId = "demo-delivery-1";
const demoCourierId = "demo-courier-1";
const demoReason = "Demo admin review";

function markDeliveryAdminReviewDemoAction(): DemoActionResult {
  return createDemoActionResult({
    action: "admin.mark_delivery_admin_review",
    message: "Demo delivery sent to admin review. No real delivery state was changed.",
    role: "admin",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function AdminDeliveryDemoActions() {
  const [result, setResult] = useState<DemoActionResult>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin demo actions</CardTitle>
        <CardDescription>
          Pilot buttons create demo results only. No courier assignment, status change or issue resolution is saved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm leading-6 text-foreground">
          Demo режим: кнопки показывают результат сценария, но пока не меняют реальные данные. В production-версии действия будут проверяться по ролям, RLS, audit log и подтверждению админа для high-risk операций. ALCOHOL_MODULE_ENABLED=false.
        </div>

        <Button className="w-full" onClick={() => setResult(assignCourierDemoAction(demoOrderId, demoCourierId))}>
          Назначить курьера
        </Button>
        <Button className="w-full" variant="outline" onClick={() => setResult(reassignCourierAfterPickupDemoAction(demoDeliveryId, demoReason))}>
          Переназначить курьера
        </Button>
        <Button className="w-full" variant="outline" onClick={() => setResult(markDeliveryAdminReviewDemoAction())}>
          Отправить на проверку
        </Button>
        <Button className="w-full" variant="danger" onClick={() => setResult(forceCloseDeliveryIssueRequestDemoAction(demoDeliveryId, demoReason))}>
          Закрыть проблему доставки
        </Button>
        <Button className="w-full" variant="danger" onClick={() => setResult(forceCompleteOrderRequestDemoAction(demoOrderId, demoReason))}>
          Запросить force complete
        </Button>

        <DemoActionResultPanel result={result} title="Admin delivery demo result" />
      </CardContent>
    </Card>
  );
}
