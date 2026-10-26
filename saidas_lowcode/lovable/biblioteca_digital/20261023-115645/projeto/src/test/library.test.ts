import { describe, expect, it } from "vitest";
import { isOverdue, LOAN_DAYS } from "@/lib/library";

describe("regras de empréstimo", () => {
  it("prazo padrão é de 14 dias", () => expect(LOAN_DAYS).toBe(14));
  it("empréstimo aberto com prazo vencido está atrasado", () => {
    expect(isOverdue({ due_at: new Date(Date.now() - 86400000).toISOString(), returned_at: null })).toBe(true);
  });
  it("empréstimo devolvido nunca está atrasado", () => {
    expect(isOverdue({ due_at: new Date(Date.now() - 86400000).toISOString(), returned_at: new Date().toISOString() })).toBe(false);
  });
});
