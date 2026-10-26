import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDaysISO, brl, fmtDate, nightsBetween, todayISO } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Casa Jardim — Quartos disponíveis" },
      { name: "description", content: "Escolha suas datas, veja os quartos livres e reserve online no Hotel Casa Jardim." },
      { property: "og:title", content: "Casa Jardim — Quartos disponíveis" },
      { property: "og:description", content: "Escolha suas datas e reserve seu quarto online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const today = todayISO();
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDaysISO(today, 2));
  const [guests, setGuests] = useState(2);
  const { user } = useAuth();
  const qc = useQueryClient();
  const valid = checkIn >= today && checkOut > checkIn;
  const nights = valid ? nightsBetween(checkIn, checkOut) : 0;

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["available", checkIn, checkOut],
    enabled: valid,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("available_rooms", { _check_in: checkIn, _check_out: checkOut });
      if (error) throw error;
      return data;
    },
  });

  const book = async (roomId: string) => {
    const { error } = await supabase.from("bookings").insert({
      room_id: roomId,
      user_id: user!.id,
      check_in: checkIn,
      check_out: checkOut,
      guests,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Reserva enviada! O hotel vai confirmar em breve.");
    qc.invalidateQueries();
  };

  const shown = (rooms ?? []).filter((r) => r.capacity >= guests);

  return (
    <main>
      <section className="relative h-[52vh] min-h-[360px] overflow-hidden">
        <img src={hero} alt="Quarto do hotel ao pôr do sol" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-16">
          <h1 className="max-w-2xl text-5xl leading-tight text-primary-foreground md:text-7xl">
            Descanse no Casa Jardim
          </h1>
          <p className="mt-2 text-lg text-primary-foreground/85">Escolha as datas e reserve seu quarto.</p>
        </div>
      </section>

      <div className="mx-auto -mt-10 max-w-6xl px-4">
        <div className="relative grid gap-4 rounded-lg border bg-card p-5 shadow-soft sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="in">Entrada</Label>
            <Input id="in" type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="out">Saída</Label>
            <Input id="out" type="date" min={addDaysISO(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g">Hóspedes</Label>
            <Input id="g" type="number" min={1} max={10} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value)))} />
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-12">
        {!valid ? (
          <p className="text-destructive">Escolha uma data de saída depois da entrada, a partir de hoje.</p>
        ) : (
          <>
            <h2 className="text-3xl">
              Disponíveis de {fmtDate(checkIn)} a {fmtDate(checkOut)}
              <span className="ml-2 font-sans text-base text-muted-foreground">({nights} {nights === 1 ? "noite" : "noites"})</span>
            </h2>
            {isLoading && <p className="mt-6 text-muted-foreground">Procurando quartos…</p>}
            {!isLoading && shown.length === 0 && (
              <p className="mt-6 text-muted-foreground">Nenhum quarto livre nessas datas. Tente outras datas.</p>
            )}
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {shown.map((r) => (
                <article key={r.id} className="flex flex-col overflow-hidden rounded-lg border bg-card">
                  {r.image_url && <img src={r.image_url} alt={r.name} loading="lazy" className="h-52 w-full object-cover" />}
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-2xl">{r.name}</h3>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users /> até {r.capacity}
                      </span>
                    </div>
                    <p className="mt-2 flex-1 text-muted-foreground">{r.description}</p>
                    <div className="mt-5 flex items-end justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">{brl(r.price_per_night)} / noite</div>
                        <div className="text-xl font-semibold">{brl(r.price_per_night * nights)} no total</div>
                      </div>
                      {user ? (
                        <Button onClick={() => book(r.id)}>Reservar</Button>
                      ) : (
                        <Button asChild variant="outline">
                          <Link to="/auth">Entre para reservar</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
