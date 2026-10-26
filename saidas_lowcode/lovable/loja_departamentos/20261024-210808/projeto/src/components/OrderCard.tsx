import type { ReactNode } from "react";
import { formatBRL, STATUS_LABEL } from "@/lib/auth";

export type OrderWithItems = {
  id: string;
  created_at: string;
  status: string;
  total: number;
  customer_name: string;
  address: string;
  phone: string;
  order_items: { id: string; product_name: string; unit_price: number; quantity: number }[];
};

export function OrderCard({ order, action }: { order: OrderWithItems; action?: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Pedido #{order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleString("pt-BR")}
          </p>
          <p className="mt-1 text-sm">
            {order.customer_name} — {order.address}
            {order.phone && ` · ${order.phone}`}
          </p>
        </div>
        {action ?? (
          <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
            {STATUS_LABEL[order.status]}
          </span>
        )}
      </div>
      <ul className="mt-4 space-y-1 text-sm">
        {order.order_items.map((i) => (
          <li key={i.id} className="flex justify-between">
            <span>
              {i.quantity}× {i.product_name}
            </span>
            <span>{formatBRL(i.unit_price * i.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between border-t pt-3 font-bold">
        <span>Total</span>
        <span className="text-primary">{formatBRL(order.total)}</span>
      </div>
    </div>
  );
}
