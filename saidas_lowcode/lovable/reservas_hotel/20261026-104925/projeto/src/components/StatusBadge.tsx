import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/format";

const styles: Record<string, string> = {
  pending: "bg-warning/20 text-foreground",
  confirmed: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", styles[status])}>
      {statusLabel[status] ?? status}
    </span>
  );
}
