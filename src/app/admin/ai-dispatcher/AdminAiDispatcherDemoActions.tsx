"use client";

import { useState } from "react";
import { createDelayAlertDemoAction } from "@/app/actions/ai-dispatcher/aiAlerts";
import {
  createAiDecisionLogDemoAction,
  createAiSafetyRefusalLogDemoAction
} from "@/app/actions/ai-dispatcher/aiDecisionLogs";
import {
  recommendCourierAssignmentDemoAction,
  recommendCourierReassignmentDemoAction
} from "@/app/actions/ai-dispatcher/aiRecommendations";
import { DemoActionResultPanel } from "@/components/shared/DemoActionResultPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type DemoActionResult = Parameters<typeof DemoActionResultPanel>[0]["result"];

const demoOrderId = "demo-order-1";
const demoAiTargetId = "demo-ai-target-1";
const demoRecommendation = "Demo AI recommendation";
const demoSafetyRefusal = "Demo safety refusal";

export function AdminAiDispatcherDemoActions() {
  const [result, setResult] = useState<DemoActionResult>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI dispatcher demo actions</CardTitle>
        <CardDescription>
          Pilot buttons create AI demo recommendations, alerts and logs only. AI does not execute actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm leading-6 text-foreground">
          Demo режим: кнопки показывают результат сценария, но пока не меняют реальные данные. В production-версии действия будут проверяться по ролям, RLS, audit log и подтверждению админа для high-risk операций. AI-диспетчер может рекомендовать, создавать alert и лог решения, но не отменяет заказы, не меняет оплату и не включает alcohol module. ALCOHOL_MODULE_ENABLED=false.
        </div>

        <Button className="w-full" onClick={() => setResult(recommendCourierAssignmentDemoAction(demoOrderId, demoRecommendation))}>
          Рекомендовать курьера
        </Button>
        <Button className="w-full" variant="outline" onClick={() => setResult(recommendCourierReassignmentDemoAction(demoOrderId, demoRecommendation))}>
          Рекомендовать переназначение
        </Button>
        <Button className="w-full" variant="outline" onClick={() => setResult(createDelayAlertDemoAction(demoAiTargetId, demoRecommendation))}>
          Создать alert задержки
        </Button>
        <Button className="w-full" variant="secondary" onClick={() => setResult(createAiDecisionLogDemoAction(demoAiTargetId, "Demo AI decision", demoRecommendation))}>
          Создать лог решения AI
        </Button>
        <Button className="w-full" variant="danger" onClick={() => setResult(createAiSafetyRefusalLogDemoAction(demoAiTargetId, "Unsafe high-risk action", demoSafetyRefusal))}>
          Создать safety refusal log
        </Button>

        <DemoActionResultPanel result={result} title="AI dispatcher demo result" />
      </CardContent>
    </Card>
  );
}
