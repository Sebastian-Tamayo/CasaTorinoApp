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
    byDay: { dayKey: string; total: number; tickets: number; cierres: number }[];
  };
  updatedAt: number;
};

const DEFAULT_CIERRES_URL =
  process.env.NEXT_PUBLIC_TPV_CIERRES_URL ||
  "https://casa-torino-web.vercel.app/api/tpv-cierres";

export async function fetchCierres(month?: string): Promise<CierresResponse> {
  const url = new URL(DEFAULT_CIERRES_URL);
  if (month) url.searchParams.set("month", month);
  const r = await fetch(url.toString(), {
    cache: "no-store",
    headers: { "Cache-Control": "no-store" },
  });
  if (!r.ok) {
    throw new Error("No se pudieron cargar los cierres del TPV (" + r.status + ")");
  }
  return r.json();
}
