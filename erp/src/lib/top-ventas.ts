/**
 * Top ventas TPV — agregación por producto desde cierres + jornada abierta.
 * REGLA: "Hoy" incluye ventas cobradas aunque la caja siga abierta.
 */
import { fetchCierres, type CierreItem } from "@/lib/cierres";
import { fetchJornada, type JornadaResponse, type JornadaSale } from "@/lib/jornada";
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

/** Lunes 00:00 Europe/Madrid de la semana ISO-like (lun–dom). */
function startOfWeekMadrid(now = new Date()): Date {
  const { year, month, day } = madridParts(now);
  // Mediodía UTC-safe: construir Date en Madrid vía noon local approx
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
  // 00:00 Madrid ≈ UTC-1/UTC+2; usamos Date.UTC medianoche-ish + margin via dayKey compare
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
  const set = new Set(dayKeys.map((k) => k.slice(0, 7)));
  return [...set];
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
    const monday = startOfWeekMadrid(now);
    const fromKey = madridDayKey(monday);
    const keys = daysBetweenKeys(fromKey, todayKey);
    return { dayKeys: keys, label: "Esta semana" };
  }

  if (periodo === "mes") {
    const fromKey = `${today.monthKey}-01`;
    const keys = daysBetweenKeys(fromKey, todayKey);
    return { dayKeys: keys, label: "Este mes" };
  }

  // trimestre
  const q = Math.floor((today.month - 1) / 3) + 1;
  const startMonth = (q - 1) * 3 + 1;
  const fromKey = `${today.year}-${String(startMonth).padStart(2, "0")}-01`;
  const keys = daysBetweenKeys(fromKey, todayKey);
  return { dayKeys: keys, label: `Trimestre Q${q}` };
}

function mergeLine(
  map: Agg,
  raw: { id?: string; name?: string; qty?: number; total?: number; price?: number },
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
    prev.qty = round2(prev.qty + qty);
    prev.total = round2(prev.total + total);
    if (!prev.name && name) prev.name = name;
  } else {
    map.set(id, { id, name, qty: round2(qty), total });
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

function mergeJornadaSales(
  map: Agg,
  sales: JornadaSale[] | undefined,
  dayKeySet: Set<string>,
) {
  if (!Array.isArray(sales)) return;
  for (const sale of sales) {
    const at = Number(sale?.at) || 0;
    if (!at) continue;
    const key = madridDayKey(at);
    if (!dayKeySet.has(key)) continue;
    for (const line of sale.lines || []) {
      mergeLine(map, {
        id: line.id,
        name: line.name,
        qty: line.qty,
        price: line.price,
      });
    }
  }
}

function ticketsFromCierres(cierres: CierreItem[], dayKeySet: Set<string>) {
  let tickets = 0;
  let total = 0;
  for (const c of cierres) {
    if (!dayKeySet.has(c.dayKey)) continue;
    tickets += Number(c.totals?.tickets) || Number(c.salesCount) || 0;
    total = round2(total + (Number(c.totals?.total) || 0));
  }
  return { tickets, total };
}

function ticketsFromOpenSales(sales: JornadaSale[] | undefined, dayKeySet: Set<string>) {
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

/**
 * Carga top productos para el periodo.
 * - Cierres del rango (sesiones ya cerradas)
 * - Si hay jornada ABIERTA: suma sus ventas del rango (tiempo real)
 * - Si jornada ENDED: no se suma (ya está en cierres) para evitar duplicar
 */
export async function loadTopVentas(
  periodo: TopPeriodo,
  now = new Date(),
): Promise<TopVentasResult> {
  const { dayKeys, label } = rangoPeriodo(periodo, now);
  const dayKeySet = new Set(dayKeys);
  const monthKeys = monthKeysForDayKeys(dayKeys);
  const map: Agg = new Map();

  const [cierres, jornada] = await Promise.all([
    fetchCierresForMonths(monthKeys),
    fetchJornada().catch(() => null as JornadaResponse | null),
  ]);

  for (const c of cierres) {
    if (!dayKeySet.has(c.dayKey)) continue;
    mergeByProduct(map, c.totals?.byProduct);
  }

  let fromOpenJornada = false;
  if (jornada?.status === "open") {
    fromOpenJornada = true;
    mergeJornadaSales(map, jornada.sales, dayKeySet);
  }

  const closed = ticketsFromCierres(cierres, dayKeySet);
  const open =
    jornada?.status === "open"
      ? ticketsFromOpenSales(jornada.sales, dayKeySet)
      : { tickets: 0, total: 0 };

  const products = [...map.values()].sort((a, b) => {
    if (b.qty !== a.qty) return b.qty - a.qty;
    return b.total - a.total;
  });

  return {
    periodo,
    label,
    products,
    tickets: closed.tickets + open.tickets,
    total: round2(closed.total + open.total),
    fromOpenJornada,
    dayKeys,
  };
}
