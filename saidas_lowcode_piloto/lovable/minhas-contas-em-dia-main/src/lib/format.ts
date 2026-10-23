export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function parse(ym: string) {
  const [y = 2000, m = 1] = ym.split("-").map(Number);
  return { y, m };
}

export function monthRange(ym: string) {
  const { y, m } = parse(ym);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, next };
}

export const currentMonth = () => new Date().toISOString().slice(0, 7);

export const monthLabel = (ym: string) => {
  const { y, m } = parse(ym);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};
