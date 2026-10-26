import { useEffect, useState } from "react";

export type CartItem = { dish_id: string; name: string; price: number; quantity: number };
const KEY = "carrinho";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem(KEY) || "[]"));
    } catch {
      /* ignore */
    }
  }, []);
  const save = (next: CartItem[]) => {
    setItems(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };
  const add = (d: { id: string; name: string; price: number }) => {
    const ex = items.find((i) => i.dish_id === d.id);
    save(
      ex
        ? items.map((i) => (i.dish_id === d.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...items, { dish_id: d.id, name: d.name, price: Number(d.price), quantity: 1 }],
    );
  };
  const setQty = (id: string, q: number) =>
    save(q <= 0 ? items.filter((i) => i.dish_id !== id) : items.map((i) => (i.dish_id === id ? { ...i, quantity: q } : i)));
  const clear = () => save([]);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return { items, add, setQty, clear, total };
}
