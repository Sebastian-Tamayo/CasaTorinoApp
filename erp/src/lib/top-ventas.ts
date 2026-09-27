/**
 * Top ventas TPV — agregación por producto desde cierres + jornada en vivo.
 * REGLA: "Hoy" usa las ventas cobradas de la jornada actual aunque siga ABIERTA
 * (misma fuente que el TPV: sales[] / totals.byProduct).
 */
import { fetchCierres, type CierreItem } from "@/lib/cierres";
import {
  fetchJornada,
  type JornadaResponse,
  type JornadaSale,
} from "@/lib/jornada";
import { round2 } from "@/lib/fiscal";

export type TopPeriodo = "hoy" | "semana" | "mes" | "trimestre";

export type TopProducto = {
  id: string;
  name: string;
  qty: number;
  total: number;
};

export type TopVentasResult = {
  periodo: TopPeriodo;
  label: string;
  products: TopProducto[];
  tickets: number;
  total: number;
  fromOpenJornada: boolean;
  dayKeys: string[];
};

type Agg = Map<string, TopProducto>;

function madridParts(ts: number | Date = Date.now()) {
  const d = ts instanceof Date ? ts : new Date(ts);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt
      .formatToParts(d)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as { year: string; month: string; day: string };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    monthKey: `${parts.year}-${parts.month}`,
  };
}

function madridDayKey(ts: number | Date = Date.now()): string {
  return madridParts(ts).dayKey;
}

/** Lunes de la semana (lun–dom) en Europe/Madrid. */
function startOfWeekMadrid(now = new Date()): Date {
  const { year, month, day } = madridParts(now);
  const noon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "short",
  }).format(noon);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = map[wd] ?? 0;
  const monday = new Date(noon.getTime() - offset * 86400000);
  const mp = madridParts(monday);
  return new Date(Date.UTC(mp.year, mp.month - 1, mp.day, 0, 0, 0));
}

function daysBetweenKeys(fromKey: string, toKey: string): string[] {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const out: string[] = [];
  let cur = new Date(Date.UTC(fy!, fm! - 1, fd!));
  const end = new Date(Date.UTC(ty!, tm! - 1, td!));
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur = new Date(cur.getTime() + 86400000);
  }
  return out;
}

function monthKeysForDayKeys(dayKeys: string[]): string[] {
  return [...new Set(dayKeys.map((k) => k.slice(0, 7)))];
}

export function rangoPeriodo(
  periodo: TopPeriodo,
  now = new Date(),
): { dayKeys: string[]; label: string } {
  const today = madridParts(now);
  const todayKey = today.dayKey;

  if (periodo === "hoy") {
    return { dayKeys: [todayKey], label: "Hoy" };
  }
  if (periodo === "semana") {
    const fromKey = madridDayKey(startOfWeekMadrid(now));
    return {
      dayKeys: daysBetweenKeys(fromKey, todayKey),
      label: "Esta semana",
    };
  }
  if (periodo === "mes") {
    return {
      dayKeys: daysBetweenKeys(`${today.monthKey}-01`, todayKey),
      label: "Este mes",
    };
  }
  const q = Math.floor((today.month - 1) / 3) + 1;
  const startMonth = (q - 1) * 3 + 1;
  const fromKey = `${today.year}-${String(startMonth).padStart(2, "0")}-01`;
  return {
    dayKeys: daysBetweenKeys(fromKey, todayKey),
    label: `Trimestre Q${q}`,
  };
}

function mergeLine(
  map: Agg,
  raw: {
    id?: string;
    name?: string;
    qty?: number;
    total?: number;
    price?: number;
  },
) {
  const qty = Number(raw.qty) || 0;
  if (!(qty > 0)) return;
  const name = String(raw.name || "").trim() || "Producto";
  const id = String(raw.id || name).trim() || name;
  let total = Number(raw.total);
  if (!Number.isFinite(total)) {
    total = round2(qty * (Number(raw.price) || 0));
  } else {
    total = round2(total);
  }
  const prev = map.get(id);
  if (prev) {
    prev.qty += qty;
    prev.total = round2(prev.total + total);
    if (name) prev.name = name;
  } else {
    map.set(id, { id, name, qty, total });
  }
}

function mergeByProduct(
  map: Agg,
  rows?: { id?: string; name?: string; qty?: number; total?: number }[] | null,
) {
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    if (!row) continue;
    mergeLine(map, row);
  }
}

/** Ventas cobradas de la jornada filtradas por día Madrid. */
function mergeJornadaSales(
  map: Agg,
  sales: JornadaSale[] | undefined,
  dayKeySet: Set<string>,
) {
  if (!Array.isArray(sales)) return 0;
  let tickets = 0;
  for (const sale of sales) {
    const at = Number(sale?.at) || 0;
    if (!at) continue;
    if (!dayKeySet.has(madridDayKey(at))) continue;
    tickets += 1;
    for (const line of sale.lines || []) {
      mergeLine(map, {
        id: line.id,
        name: line.name,
        qty: line.qty,
        price: line.price,
      });
    }
  }
  return tickets;
}

function ticketsTotalFromCierres(cierres: CierreItem[], dayKeySet: Set<string>) {
  let tickets = 0;
  let total = 0;
  for (const c of cierres) {
    if (!dayKeySet.has(c.dayKey)) continue;
    tickets += Number(c.totals?.tickets) || Number(c.salesCount) || 0;
    total = round2(total + (Number(c.totals?.total) || 0));
  }
  return { tickets, total };
}

function moneyFromSales(sales: JornadaSale[] | undefined, dayKeySet: Set<string>) {
  let tickets = 0;
  let total = 0;
  if (!Array.isArray(sales)) return { tickets, total };
  for (const sale of sales) {
    const at = Number(sale?.at) || 0;
    if (!at || !dayKeySet.has(madridDayKey(at))) continue;
    tickets += 1;
    total = round2(total + (Number(sale.total) || 0));
  }
  return { tickets, total };
}

async function fetchCierresForMonths(monthKeys: string[]): Promise<CierreItem[]> {
  const packs = await Promise.all(
    monthKeys.map(async (month) => {
      try {
        return await fetchCierres(month);
      } catch {
        return null;
      }
    }),
  );
  const items: CierreItem[] = [];
  for (const pack of packs) {
    if (pack?.items?.length) items.push(...pack.items);
  }
  return items;
}

function hasLiveJornada(j: JornadaResponse | null | undefined): boolean {
  if (!j) return false;
  return j.status === "open" || j.status === "ended";
}

/**
 * Carga top productos.
 *
 * Hoy (crítico):
 *  - Si hay jornada open/ended → ventas cobradas de esa jornada (aunque caja abierta)
 *  - + cierres de otros días no aplica; para el mismo día, si la jornada está
 *    open/ended usamos SOLO la jornada (evita duplicar y es la fuente en vivo)
 *  - Si no hay jornada → cierres del dayKey de hoy
 *
 * Semana / mes / trimestre:
 *  - Cierres del rango
 *  - + ventas de jornada open/ended cuyo día cae en el rango
 *    (si ese día también tiene cierre y la jornada está ended, no duplicar:
 *     cuando ended, los cierres ya tienen el día → no sumar jornada ended)
 */
export async function loadTopVentas(
  periodo: TopPeriodo,
  now = new Date(),
): Promise<TopVentasResult> {
  const { dayKeys, label } = rangoPeriodo(periodo, now);
  const dayKeySet = new Set(dayKeys);
  const todayKey = madridDayKey(now);
  const monthKeys = monthKeysForDayKeys(dayKeys);
  const map: Agg = new Map();

  const [cierres, jornada] = await Promise.all([
    fetchCierresForMonths(monthKeys),
    fetchJornada().catch(() => null as JornadaResponse | null),
  ]);

  const live = hasLiveJornada(jornada);
  const open = jornada?.status === "open";
  let fromOpenJornada = false;
  let tickets = 0;
  let total = 0;

  if (periodo === "hoy") {
    if (live && Array.isArray(jornada?.sales) && jornada!.sales!.length > 0) {
      // Fuente en vivo = TPV (caja abierta o recién cerrada sin perder sales)
      fromOpenJornada = open;
      tickets = mergeJornadaSales(map, jornada!.sales, dayKeySet);
      total = moneyFromSales(jornada!.sales, dayKeySet).total;

      // Si por TZ no entró ninguna línea pero hay byProduct, usar byProduct
      if (map.size === 0 && jornada?.totals?.byProduct?.length) {
        mergeByProduct(map, jornada.totals.byProduct);
        tickets = Number(jornada.totals.tickets) || jornada.sales.length;
        total = round2(Number(jornada.totals.total) || 0);
        fromOpenJornada = open;
      }
    } else {
      // Sin jornada activa: historial de cierres de hoy
      for (const c of cierres) {
        if (c.dayKey !== todayKey) continue;
        mergeByProduct(map, c.totals?.byProduct);
      }
      const closed = ticketsTotalFromCierres(
        cierres.filter((c) => c.dayKey === todayKey),
        dayKeySet,
      );
      tickets = closed.tickets;
      total = closed.total;
    }
  } else {
    // Historial por cierres
    for (const c of cierres) {
      if (!dayKeySet.has(c.dayKey)) continue;
      mergeByProduct(map, c.totals?.byProduct);
    }
    const closed = ticketsTotalFromCierres(cierres, dayKeySet);
    tickets = closed.tickets;
    total = closed.total;

    // Caja abierta: sumar cobros de hoy (u otros días del rango) en vivo
    if (open && Array.isArray(jornada?.sales)) {
      fromOpenJornada = true;
      const before = map.size;
      const t = mergeJornadaSales(map, jornada!.sales, dayKeySet);
      const m = moneyFromSales(jornada!.sales, dayKeySet);
      tickets += m.tickets;
      total = round2(total + m.total);
      if (map.size === before && jornada?.totals?.byProduct?.length) {
        // fallback
        mergeByProduct(map, jornada.totals.byProduct);
      }
      void t;
    }
  }

  const products = [...map.values()]
    .map((p) => ({
      ...p,
      qty: round2(p.qty),
      total: round2(p.total),
    }))
    .sort((a, b) => {
      if (b.qty !== a.qty) return b.qty - a.qty;
      return b.total - a.total;
    });

  return {
    periodo,
    label,
    products,
    tickets,
    total: round2(total),
    fromOpenJornada,
    dayKeys,
  };
}
