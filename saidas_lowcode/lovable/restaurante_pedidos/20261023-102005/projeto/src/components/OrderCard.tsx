import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, brl } from "@/lib/auth";

export type OrderRow = {
  id: string;
  status: string;
  total: number;
  notes: string;
  created_at: string;
  user_id: string;
  order_items: { id: string; dish_name: string; quantity: number; unit_price: number }[];
};

export function OrderCard({ order, title, actions }: { order: OrderRow; title?: string; actions?: ReactNode }) {
  const variant = order.status === "cancelado" ? "destructive" : order.status === "entregue" ? "outline" : "default";
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {title && <p className="font-semibold">{title}</p>}
          <p className="text-sm text-muted-foreground">
            Pedido #{order.id.slice(0, 6).toUpperCase()} · {new Date(order.created_at).toLocaleString("pt-BR")}
          </p>
        </div>
        <Badge variant={variant}>{STATUS_LABEL[order.status]}</Badge>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {order.order_items.map((i) => (
          <li key={i.id} className="flex justify-between">
            <span>{i.quantity}× {i.dish_name}</span>
            <span>{brl(i.unit_price * i.quantity)}</span>
          </li>
        ))}
      </ul>
      {order.notes && <p className="mt-2 text-sm italic text-muted-foreground">Obs.: {order.notes}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <span className="font-semibold">Total {brl(order.total)}</span>
        {actions}
      </div>
    </div>
  );
}
