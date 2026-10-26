export const brl = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export function monthRange(ym: string) {
  const [y = 2000, m = 1] = ym.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(y, m, 1));
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

export const currentMonth = () => new Date().toISOString().slice(0, 7);

export const monthLabel = (ym: string) => {
  const [y = 2000, m = 1] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export const dateLabel = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};
