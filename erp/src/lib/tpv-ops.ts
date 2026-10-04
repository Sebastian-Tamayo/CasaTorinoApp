/**
 * Formas de respuesta TPV leídas desde Supabase ops_kv
 * (claves `jornada` y `cierres`) — sin llamar a APIs Vercel.
 */

export type JornadaState = {
  kind?: string;
  status?: "closed" | "open" | "ended";
  startedAt?: number | null;
  endedAt?: number | null;
  sales?: Array<{
    id?: string;
    at?: number;
    mesa?: string;
    total?: number;
    tip?: number;
    paymentMethod?: string;
    lines?: Array<{
      id?: string;
      name?: string;
      qty?: number;
      price?: number;
      categoryType?: string;
      catId?: string;
      catName?: string;
    }>;
  }>;
  totals?: unknown;
  updatedAt?: number;
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
  salesCount?: number;
  salesPreview?: { id: string; at: number; mesa: string; total: number }[];
  updatedAt?: number;
};

function round2(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function emptyJornada(): JornadaState {
  return {
    kind: "casa-torino-jornada",
    status: "closed",
    startedAt: null,
    endedAt: null,
    sales: [],
    updatedAt: 0,
  };
}

export function emptyCierres() {
  return {
    kind: "casa-torino-cierres",
    items: [] as CierreItem[],
    updatedAt: 0,
  };
}

/** Recalcula totals.byProduct (lo que usa Top ventas). */
export function withJornadaTotals(state: JornadaState): JornadaState {
  const sales = Array.isArray(state.sales) ? state.sales : [];
  const byProduct: Record<
    string,
    { id: string; name: string; qty: number; total: number; categoryType?: string; catId?: string }
  > = {};
  let tickets = 0;
  let grand = 0;
  let tipTotal = 0;
  const byType = {
    comida: { qty: 0, total: 0 },
    bebida: { qty: 0, total: 0 },
  };
  const byPayment = {
    efectivo: { total: 0, tickets: 0 },
    tarjeta: { total: 0, tickets: 0 },
  };

  for (const sale of sales) {
    tickets += 1;
    const saleTotal = Number(sale.total) || 0;
    grand = round2(grand + saleTotal);
    tipTotal = round2(tipTotal + (Number(sale.tip) || 0));
    const pm = sale.paymentMethod === "tarjeta" ? "tarjeta" : "efectivo";
    byPayment[pm].total = round2(byPayment[pm].total + saleTotal);
    byPayment[pm].tickets += 1;

    for (const l of sale.lines || []) {
      const ctype = l.categoryType === "bebida" ? "bebida" : "comida";
      const lineTotal = round2((Number(l.qty) || 0) * (Number(l.price) || 0));
      const qty = Number(l.qty) || 0;
      byType[ctype].qty += qty;
      byType[ctype].total = round2(byType[ctype].total + lineTotal);
      const id = String(l.id || l.name || "item").slice(0, 80);
      const name = String(l.name || id);
      if (!byProduct[id]) {
        byProduct[id] = {
          id,
          name,
          qty: 0,
          total: 0,
          categoryType: ctype,
          catId: l.catId,
        };
      }
      byProduct[id].qty += qty;
      byProduct[id].total = round2(byProduct[id].total + lineTotal);
      byProduct[id].name = name;
    }
  }

  return {
    ...emptyJornada(),
    ...state,
    sales,
    totals: {
      tickets,
      total: grand,
      tipTotal,
      byType,
      byPayment,
      byProduct: Object.values(byProduct).sort((a, b) => b.qty - a.qty),
    },
  };
}

export function buildCierresResponse(
  store: { items?: CierreItem[]; updatedAt?: number } | null,
  month: string,
) {
  const base = store && typeof store === "object" ? store : emptyCierres();
  let items = Array.isArray(base.items) ? base.items.slice() : [];
  items.sort((a, b) => (Number(b.endedAt) || 0) - (Number(a.endedAt) || 0));
  if (month) items = items.filter((c) => c.monthKey === month);

  const months = [
    ...new Set(
      (Array.isArray(base.items) ? base.items : [])
        .map((c) => c.monthKey)
        .filter(Boolean),
    ),
  ].sort((a, b) => (a < b ? 1 : -1));

  let total = 0;
  let tickets = 0;
  let comida = 0;
  let bebida = 0;
  let tipTotal = 0;
  const byPayment = {
    efectivo: { total: 0, tickets: 0 },
    tarjeta: { total: 0, tickets: 0 },
  };
  const byDay: Record<
    string,
    { dayKey: string; total: number; tickets: number; cierres: number }
  > = {};

  for (const c of items) {
    const t = Number(c?.totals?.total) || 0;
    const tk = Number(c?.totals?.tickets) || 0;
    total = round2(total + t);
    tickets += tk;
    comida = round2(comida + (Number(c?.totals?.byType?.comida?.total) || 0));
    bebida = round2(bebida + (Number(c?.totals?.byType?.bebida?.total) || 0));
    tipTotal = round2(tipTotal + (Number(c?.totals?.tipTotal) || 0));
    const bp = c?.totals?.byPayment;
    if (bp && typeof bp === "object") {
      byPayment.efectivo.total = round2(
        byPayment.efectivo.total + (Number(bp.efectivo?.total) || 0),
      );
      byPayment.efectivo.tickets += Number(bp.efectivo?.tickets) || 0;
      byPayment.tarjeta.total = round2(
        byPayment.tarjeta.total + (Number(bp.tarjeta?.total) || 0),
      );
      byPayment.tarjeta.tickets += Number(bp.tarjeta?.tickets) || 0;
    } else {
      byPayment.efectivo.total = round2(byPayment.efectivo.total + t);
      byPayment.efectivo.tickets += tk;
    }
    const day = c.dayKey || "—";
    if (!byDay[day]) byDay[day] = { dayKey: day, total: 0, tickets: 0, cierres: 0 };
    byDay[day].total = round2(byDay[day].total + t);
    byDay[day].tickets += tk;
    byDay[day].cierres += 1;
  }

  return {
    kind: "casa-torino-cierres",
    month: month || null,
    months,
    items,
    monthTotals: {
      total,
      tickets,
      byType: { comida: { total: comida }, bebida: { total: bebida } },
      byPayment,
      tipTotal,
      byDay: Object.values(byDay).sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1)),
    },
    updatedAt: Number(base.updatedAt) || 0,
    source: "supabase-ops_kv",
  };
}
