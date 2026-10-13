const CATEGORY_EMOJI: Record<string, string> = {
  "Design": "🎨",
  "Programação": "💻",
  "Marketing": "📈",
  "Escritório": "📝",
  "Fotografia": "📷",
  "Tradução": "🌐",
  "Educação": "🎓",
  "Música": "🎵",
  "Finanças": "💰",
  "Outros": "✨",
};

export const CATEGORIES = Object.keys(CATEGORY_EMOJI);

export function emojiFor(cat: string): string {
  return CATEGORY_EMOJI[cat] || "📌";
}

export function formatPrice(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}
