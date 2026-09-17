/** Cliente del histórico mensual de consumo TPV + cocina. */

export type ConsumoSaleLine = {
  id: string;
  name: string;
  qty: number;
  price: number;
  categoryType?: string;
  catId?: string;
  catName?: string;
};

export type ConsumoSale = {
  id: string;
  at: number;
  mesa: string;
  total: number;
  lines: ConsumoSaleLine[];
};

export type ConsumoDay = {
  dayKey: string;
  monthKey: string;
  status?: "live" | "closed" | string;
  startedAt?: number | null;
  endedAt?: number | null;
  sales?: ConsumoSale[];
  totals?: {
    tickets: number;
    total: number;
    byType?: {
      comida?: { qty?: number; total?: number };
      bebida?: { qty?: number; total?: number };
    };
    byCategory?: { id: string; name: string; qty: number; total: number }[];
    byProduct?: {
      id: string;
      name: string;
      qty: number;
      total: number;
      categoryType?: string;
    }[];
  };
  kitchen?: {
    items: { id: string; name: string; qty: number; catId?: string }[];
    ordersCount: number;
    qtyTotal: number;
  };
  manualTotal?: number | null;
  notes?: string;
  updatedAt?: number;
};

export type ConsumoResponse = {
  kind: string;
  month: string | null;
  months: string[];
  liveDay: string;
  items: ConsumoDay[];
  monthTotals: {
    total: number;
    tickets: number;
    byType: {
      comida: { total: number };
      bebida: { total: number };
    };
    kitchenQty: number;
    byDay: {
      dayKey: string;
      total: number;
      tickets: number;
      status: string;
      kitchenQty: number;
      manual?: boolean;
    }[];
  };
  updatedAt: number;
};

const DEFAULT_URL =
  process.env.NEXT_PUBLIC_TPV_CONSUMO_URL ||
  "https://casa-torino-web.vercel.app/api/tpv-consumo";

/** Lectura vía proxy ERP; fallback al API web. */
export async function fetchConsumo(month?: string): Promise<ConsumoResponse> {
  const qs = month ? `?month=${encodeURIComponent(month)}` : "";
  const r = await fetch(`/api/consumo${qs}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Cache-Control": "no-store" },
  });
  if (!r.ok) {
    const direct = new URL(DEFAULT_URL);
    if (month) direct.searchParams.set("month", month);
    const r2 = await fetch(direct.toString(), {
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    });
    if (!r2.ok) {
      throw new Error("No se pudo cargar el consumo mensual (" + r.status + ")");
    }
    return r2.json();
  }
  return r.json();
}

async function postConsumo(body: Record<string, unknown>) {
  const r = await fetch("/api/consumo", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      (data && typeof data.error === "string" && data.error) ||
        "Error al guardar (" + r.status + ")",
    );
  }
  return data;
}

export async function setManualTotal(
  dayKey: string,
  manualTotal: number | null,
  notes?: string,
) {
  return postConsumo({
    action: "setManualTotal",
    dayKey,
    manualTotal,
    notes,
  });
}

export async function updateConsumoLine(
  dayKey: string,
  saleId: string,
  lineId: string,
  patch: { qty?: number; price?: number },
) {
  return postConsumo({
    action: "updateLine",
    dayKey,
    saleId,
    lineId,
    ...patch,
  });
}

export async function deleteConsumoSale(dayKey: string, saleId: string) {
  return postConsumo({
    action: "deleteSale",
    dayKey,
    saleId,
  });
}
