import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const fmtDate = (d: string | Date) => format(new Date(d), "EEEE, dd 'de' MMMM", { locale: ptBR });
export const fmtTime = (d: string | Date) => format(new Date(d), "HH:mm");
export const fmtDateTime = (d: string | Date) =>
  format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
export const fmtPrice = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const statusLabel: Record<string, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  rejected: "Recusado",
  cancelled: "Cancelado",
};
