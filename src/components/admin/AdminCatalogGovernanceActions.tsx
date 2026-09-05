import { randomUUID } from "node:crypto";
import { adminCatalogGovernanceFormAction } from "@/app/actions/admin/adminCatalogGovernance";
import { Badge } from "@/components/ui/Badge";
import type { AdminCatalogItem } from "@/lib/types/admin-catalog";

export function AdminCatalogGovernanceActions({
  canGovern,
  item,
  source
}: {
  canGovern: boolean;
  item: AdminCatalogItem;
  source: "mock" | "supabase" | "fallback";
}) {
  if (source !== "supabase") {
    return (
      <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-muted">
        Governance writes disabled: this view is not backed by authenticated Supabase truth.
      </div>
    );
  }
  if (!canGovern) {
    return (
      <div className="rounded-md border border-border bg-background p-3 text-sm text-muted">
        Read-only admin view. Publish, unpublish and archive authority is restricted to super-admin.
      </div>
    );
  }

  const domain = item.domain;
  if (domain === "categories") return null;

  const safetyBlocked = (item.safetyFlags?.length ?? 0) > 0;
  const actions: Array<"publish" | "unpublish" | "archive"> = [];
  if (item.status === "approved" && !safetyBlocked) actions.push("publish");
  if (item.status === "active") actions.push("unpublish");
  if (["under_review", "approved", "rejected", "active"].includes(item.status)) actions.push("archive");

  if (actions.length === 0) return <Badge variant="muted">No governance action for current status</Badge>;

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-background p-4" data-testid="admin-catalog-governance-actions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Catalog governance</p>
        <Badge variant={safetyBlocked ? "warning" : "success"}>
          {safetyBlocked ? "Publish blocked by safety review" : "Super-admin write"}
        </Badge>
      </div>
      {actions.map((action) => (
        <GovernanceForm key={action} action={action} domain={domain} itemId={item.id} />
      ))}
    </div>
  );
}

function GovernanceForm({
  action,
  domain,
  itemId
}: {
  action: "publish" | "unpublish" | "archive";
  domain: "food" | "tours" | "stays" | "products";
  itemId: string;
}) {
  const labels = {
    publish: { button: "Publish", reason: "Publication reason" },
    unpublish: { button: "Unpublish", reason: "Unpublish reason" },
    archive: { button: "Archive", reason: "Archive reason" }
  } as const;
  const destructive = action === "archive";
  return (
    <form action={adminCatalogGovernanceFormAction} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
      <input name="itemId" type="hidden" value={itemId} />
      <input name="domain" type="hidden" value={domain} />
      <input name="action" type="hidden" value={action} />
      <input name="requestId" type="hidden" value={randomUUID()} />
      <label className="grid gap-1 text-sm font-medium text-foreground">
        {labels[action].reason}
        <input
          className="min-h-11 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
          maxLength={500}
          minLength={3}
          name="reason"
          placeholder={`Reason to ${action} this catalog item`}
          required
          type="text"
        />
      </label>
      <button
        className={destructive
          ? "min-h-11 rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/15"
          : "min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"}
        type="submit"
      >
        {labels[action].button}
      </button>
    </form>
  );
}
