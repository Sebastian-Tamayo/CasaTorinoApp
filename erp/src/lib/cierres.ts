/** Cliente de cierres TPV (ingreso diario oficial del ecosistema). */

export type CierreSaleLine = {
  id?: string;
  name?: string;
  qty?: number;
  price?: number;
  categoryType?: string;
  catId?: string;
  catName?: string;
};

export type CierreSale = {
  id?: string;
  at?: number;
  mesa?: string;
  total?: number;
  tip?: number;
  base?: number;
  iva?: number;
  paymentMethod?: string;
  payments?: Array<{ id?: string; method?: string; amount?: number }>;
  waiterId?: string | null;
  waiterName?: string | null;
  lines?: CierreSaleLine[];
};

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
  sales?: CierreSale[];
  salesCount?: number;
  salesPreview?: { id: string; at: number; mesa: string; total: number }[];
  /** Ocupación por hora (Europe/Madrid) al cerrar caja — informes email */
  activityByHour?: {
    hour: number;
    mesas: number;
    tickets: number;
    total: number;
  }[];
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

export type CierreEditResponse = CierresResponse & {
  ok: boolean;
  cierre: CierreItem;
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

export function isEfectivoSale(sale: CierreSale | undefined | null): boolean {
  if (!sale) return false;
  const pm = String(sale.paymentMethod || "efectivo").toLowerCase();
  return pm === "efectivo" || pm === "cash" || pm === "";
}

/** Guarda corrección de un ticket en efectivo dentro de un cierre. */
export async function saveCierreSaleEdit(opts: {
  action: "updateSale" | "updateLine" | "deleteSale";
  cierreId: string;
  month?: string;
  saleId?: string;
  sale?: CierreSale;
  lineId?: string;
  qty?: number;
  price?: number;
}): Promise<CierreEditResponse> {
  const r = await fetch("/api/cierres", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(opts),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      (data && typeof data.error === "string" && data.error) ||
        `No se pudo guardar (${r.status})`,
    );
  }
  return data as CierreEditResponse;
}
