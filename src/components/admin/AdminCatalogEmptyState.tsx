import { Card, CardContent } from "@/components/ui/Card";

export function AdminCatalogEmptyState({ label = "No catalog records found." }: { label?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
      </CardContent>
    </Card>
  );
}
