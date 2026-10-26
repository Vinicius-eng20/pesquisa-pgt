import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/format";

const styles: Record<string, string> = {
  pending: "bg-warning text-warning-foreground",
  confirmed: "bg-success text-success-foreground",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", styles[status])}>
      {statusLabel[status] ?? status}
    </span>
  );
}
