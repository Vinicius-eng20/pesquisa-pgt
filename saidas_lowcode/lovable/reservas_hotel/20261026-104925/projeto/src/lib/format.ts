export const brl = (n: number) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export const nightsBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const statusLabel: Record<string, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmada",
  rejected: "Recusada",
  cancelled: "Cancelada",
};
