/** Cliente de jornada TPV (ventas en tiempo real, caja abierta o cerrada). */

export type JornadaSaleLine = {
  id?: string;
  name?: string;
  qty?: number;
  price?: number;
  categoryType?: string;
  catId?: string;
  catName?: string;
};

export type JornadaSale = {
  id?: string;
  at?: number;
  mesa?: string;
  total?: number;
  lines?: JornadaSaleLine[];
};

export type JornadaProduct = {
  id: string;
  name: string;
  qty: number;
  total: number;
  categoryType?: string;
  catId?: string;
};

export type JornadaResponse = {
  kind?: string;
  status?: "closed" | "open" | "ended";
  startedAt?: number | null;
  endedAt?: number | null;
  sales?: JornadaSale[];
  totals?: {
    tickets?: number;
    total?: number;
    byProduct?: JornadaProduct[];
  };
  updatedAt?: number;
};

export async function fetchJornada(): Promise<JornadaResponse> {
  const r = await fetch("/api/jornada", {
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Cache-Control": "no-store" },
  });
  if (!r.ok) {
    throw new Error("No se pudo cargar la jornada del TPV (" + r.status + ")");
  }
  return r.json();
}
