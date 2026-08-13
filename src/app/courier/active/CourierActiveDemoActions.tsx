"use client";

import { useState } from "react";
import {
  markCourierToClientDemoAction,
  markCourierToPartnerDemoAction,
  markDeliveredDemoAction,
  markPickedUpDemoAction
} from "@/app/actions/courier/courierDeliveries";
import { DemoActionResultPanel } from "@/components/shared/DemoActionResultPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type DemoActionResult = Parameters<typeof DemoActionResultPanel>[0]["result"];

const demoDeliveryId = "demo-delivery-1";

export function CourierActiveDemoActions() {
  const [result, setResult] = useState<DemoActionResult>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo delivery actions</CardTitle>
        <CardDescription>
          Pilot buttons call safe demo actions only. They do not update real delivery status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm leading-6 text-foreground">
          Demo режим: кнопки показывают результат сценария, но пока не меняют реальные данные. В production-версии действия будут проверяться по ролям, RLS, audit log и подтверждению админа для high-risk операций. ALCOHOL_MODULE_ENABLED=false.
        </div>

        <Button className="w-full" variant="outline" onClick={() => setResult(markCourierToPartnerDemoAction(demoDeliveryId))}>
          Еду к партнёру
        </Button>
        <Button className="w-full" variant="secondary" onClick={() => setResult(markPickedUpDemoAction(demoDeliveryId))}>
          Забрал заказ
        </Button>
        <Button className="w-full" variant="outline" onClick={() => setResult(markCourierToClientDemoAction(demoDeliveryId))}>
          Еду к клиенту
        </Button>
        <Button className="w-full" variant="secondary" onClick={() => setResult(markDeliveredDemoAction(demoDeliveryId))}>
          Доставлено
        </Button>

        <DemoActionResultPanel result={result} title="Courier demo result" />
      </CardContent>
    </Card>
  );
}
