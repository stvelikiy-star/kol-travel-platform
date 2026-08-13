import { Card, CardContent } from "@/components/ui/Card";

export function PartnerCatalogEmptyState({ message = "No catalog records to display." }: { message?: string }) {
  return (
    <Card>
      <CardContent className="p-5 text-sm text-muted">{message}</CardContent>
    </Card>
  );
}
