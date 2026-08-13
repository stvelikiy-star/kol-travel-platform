import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type DemoActionRiskLevel = "low" | "medium" | "high" | "critical";
type DemoActionRole = "partner" | "courier" | "admin" | "ai_dispatcher" | "client";

type DemoActionResult = {
  ok: boolean;
  mode: "demo" | "real";
  action: string;
  message: string;
  role?: DemoActionRole;
  riskLevel?: DemoActionRiskLevel;
  humanApprovalRequired?: boolean;
  auditRequired?: boolean;
  alcoholModuleEnabled?: false;
  auditLogId?: string;
  code?: string;
};

type DemoActionResultPanelProps = {
  result?: DemoActionResult;
  title?: string;
};

const riskTone: Record<
  DemoActionRiskLevel,
  {
    label: string;
    badge: BadgeVariant;
    note: string;
    className: string;
  }
> = {
  low: {
    label: "Low risk",
    badge: "success",
    note: "Demo action is informational or routine.",
    className: "border-success/20 bg-success/5"
  },
  medium: {
    label: "Medium risk",
    badge: "warning",
    note: "Requires attention before real backend wiring.",
    className: "border-warning/25 bg-warning/5"
  },
  high: {
    label: "High risk",
    badge: "danger",
    note: "Real version must show an audit and approval warning.",
    className: "border-danger/25 bg-danger/5"
  },
  critical: {
    label: "Critical risk",
    badge: "danger",
    note: "Critical action: real version requires strict human approval and audit.",
    className: "border-danger/40 bg-danger/10"
  }
};

const roleLabel: Record<DemoActionRole, string> = {
  partner: "Partner",
  courier: "Courier",
  admin: "Admin",
  ai_dispatcher: "AI dispatcher",
  client: "Client"
};

export function DemoActionResultPanel({ result, title = "Demo action result" }: DemoActionResultPanelProps) {
  if (!result) {
    return null;
  }

  const tone = result.riskLevel ? riskTone[result.riskLevel] : undefined;
  const modeLabel = result.mode === "real" ? "Real pilot mode" : "Demo mode";

  return (
    <Card
      className={cn(
        "overflow-hidden border-primary/15 bg-surface/95",
        tone?.className
      )}
    >
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={result.mode === "real" ? "warning" : "info"}>{modeLabel}</Badge>
          {result.role ? <Badge variant="muted">{roleLabel[result.role]}</Badge> : null}
          {tone ? <Badge variant={tone.badge}>{tone.label}</Badge> : null}
        </div>
        <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/80 bg-background/70 p-3">
          <p className="text-sm font-medium leading-6 text-foreground">{result.message}</p>
          <p className="mt-2 break-words text-xs leading-5 text-muted">
            Action: <span className="font-semibold text-foreground">{result.action}</span>
          </p>
          {result.auditLogId ? (
            <p className="mt-1 break-words text-xs leading-5 text-muted">
              Audit log id: <span className="font-semibold text-foreground">{result.auditLogId}</span>
            </p>
          ) : null}
          {result.code ? (
            <p className="mt-1 break-words text-xs leading-5 text-muted">
              Safe code: <span className="font-semibold text-foreground">{result.code}</span>
            </p>
          ) : null}
        </div>

        {tone ? (
          <p className="rounded-lg border border-border/80 bg-surface/70 p-3 text-sm leading-6 text-muted">
            {tone.note}
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          {result.auditRequired ? (
            <p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm leading-6 text-foreground">
              В реальной версии будет запись в журнале аудита.
            </p>
          ) : null}

          {result.humanApprovalRequired ? (
            <p className="rounded-lg border border-danger/25 bg-danger/10 p-3 text-sm leading-6 text-foreground">
              В реальной версии требуется подтверждение админа.
            </p>
          ) : null}
        </div>

        <p className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs font-semibold leading-5 text-primary">
          ALCOHOL_MODULE_ENABLED=false. Alcohol module disabled.
        </p>
      </CardContent>
    </Card>
  );
}
