/** Cliente de cierres TPV (ingreso diario oficial del ecosistema). */

export type CierreItem = {
  id: string;
  source?: string;
  startedAt: number | null;
  endedAt: number | null;
  dayKey: string;
  monthKey: string;
  totals: {
    tickets: number;
    total: number;
    byType?: {
      comida?: { qty?: number; total?: number };
      bebida?: { qty?: number; total?: number };
    };
    byCategory?: { id: string; name: string; qty: number; total: number }[];
    byProduct?: { id: string; name: string; qty: number; total: number }[];
    byPayment?: {
      efectivo?: { total?: number; tickets?: number };
      tarjeta?: { total?: number; tickets?: number };
    };
    tipTotal?: number;
  };
  salesCount?: number;
  salesPreview?: { id: string; at: number; mesa: string; total: number }[];
  updatedAt?: number;
};

export type CierresResponse = {
  kind: string;
  month: string | null;
  months: string[];
  items: CierreItem[];
  monthTotals: {
    total: number;
    tickets: number;
    byType: {
      comida: { total: number };
      bebida: { total: number };
    };
    byPayment?: {
      efectivo: { total: number; tickets: number };
      tarjeta: { total: number; tickets: number };
    };
    tipTotal?: number;
    byDay: { dayKey: string; total: number; tickets: number; cierres: number }[];
  };
  updatedAt: number;
};

export async function fetchCierres(month?: string): Promise<CierresResponse> {
  const qs = month ? `?month=${encodeURIComponent(month)}` : "";
  const r = await fetch(`/api/cierres${qs}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Cache-Control": "no-store" },
  });
  if (!r.ok) {
    throw new Error("No se pudieron cargar los cierres del TPV (" + r.status + ")");
  }
  return r.json();
}
