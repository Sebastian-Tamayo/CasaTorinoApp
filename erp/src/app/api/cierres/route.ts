import { NextResponse } from "next/server";
import { hasErpPinSession } from "@/lib/erp-auth";
import { getOpsKvJson, hasOpsKvConfig, setOpsKvJson } from "@/lib/ops-kv";
import {
  buildCierresResponse,
  emptyCierres,
  normalizeEditedSale,
  recomputeCierreFromSales,
  withJornadaTotals,
  type CierreItem,
  type CierreSale,
  type JornadaState,
} from "@/lib/tpv-ops";

export const dynamic = "force-dynamic";

type CierresStore = {
  kind?: string;
  items?: CierreItem[];
  updatedAt?: number;
};

function isEfectivoSale(sale: CierreSale | undefined | null): boolean {
  if (!sale) return false;
  const pm = String(sale.paymentMethod || "efectivo").toLowerCase();
  // Solo tickets 100 % efectivo (mixto/tarjeta no editables desde ERP)
  return pm === "efectivo" || pm === "cash" || pm === "";
}

function round2(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

async function loadCierresStore(): Promise<CierresStore> {
  const raw = await getOpsKvJson<CierresStore>("cierres");
  if (raw && typeof raw === "object") return raw;
  return emptyCierres();
}

async function saveCierresStore(store: CierresStore): Promise<void> {
  await setOpsKvJson("cierres", {
    kind: "casa-torino-cierres",
    items: Array.isArray(store.items) ? store.items : [],
    updatedAt: Date.now(),
  });
}

/** Si el cierre editado es la jornada ended actual, alinea también `jornada`. */
async function syncEndedJornada(cierre: CierreItem): Promise<void> {
  try {
    const jornada = await getOpsKvJson<JornadaState>("jornada");
    if (!jornada || typeof jornada !== "object") return;
    if (jornada.status !== "ended") return;
    const started = Number(jornada.startedAt) || 0;
    if (!started || started !== Number(cierre.startedAt)) return;
    const next = withJornadaTotals({
      ...jornada,
      sales: (Array.isArray(cierre.sales) ? cierre.sales : []) as JornadaState["sales"],
      endedAt: Number(cierre.endedAt) || jornada.endedAt || Date.now(),
      updatedAt: Date.now(),
    });
    await setOpsKvJson("jornada", next);
  } catch (err) {
    console.warn("[erp/api/cierres] sync jornada", err);
  }
}

/** Historial de cierres TPV desde Supabase ops_kv (clave `cierres`). */
export async function GET(request: Request) {
  const ok = await hasErpPinSession();
  if (!ok) {
    return NextResponse.json({ error: "Sesión ERP requerida" }, { status: 401 });
  }
  if (!hasOpsKvConfig()) {
    return NextResponse.json(
      { error: "Falta configuración Supabase en el ERP" },
      { status: 500 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const month = String(searchParams.get("month") || "").trim();
    const store = await loadCierresStore();
    return NextResponse.json(buildCierresResponse(store, month));
  } catch (err) {
    console.error("[erp/api/cierres]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error ops_kv" },
      { status: 500 },
    );
  }
}

/**
 * Corregir tickets en efectivo de un cierre archivado.
 * body: { action, cierreId, saleId?, sale?, lineId?, qty?, price?, month? }
 * actions: updateSale | updateLine | deleteSale
 */
export async function POST(request: Request) {
  const ok = await hasErpPinSession();
  if (!ok) {
    return NextResponse.json({ error: "Sesión ERP requerida" }, { status: 401 });
  }
  if (!hasOpsKvConfig()) {
    return NextResponse.json(
      { error: "Falta configuración Supabase en el ERP" },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const action = String(body.action || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "");
    const cierreId = String(body.cierreId || "").slice(0, 80);
    const month = String(body.month || "").trim();

    if (!cierreId) {
      return NextResponse.json({ error: "cierreId requerido" }, { status: 400 });
    }
    if (!["updatesale", "updateline", "deletesale"].includes(action)) {
      return NextResponse.json(
        { error: "action inválida (updateSale|updateLine|deleteSale)" },
        { status: 400 },
      );
    }

    const store = await loadCierresStore();
    const items = Array.isArray(store.items) ? store.items.slice() : [];
    const idx = items.findIndex((c) => c && c.id === cierreId);
    if (idx < 0) {
      return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });
    }

    let cierre: CierreItem = {
      ...items[idx],
      sales: Array.isArray(items[idx].sales) ? items[idx].sales!.slice() : [],
    };
    const sales = (cierre.sales || []).slice();

    if (action === "deletesale") {
      const saleId = String(body.saleId || body.id || "").slice(0, 64);
      if (!saleId) {
        return NextResponse.json({ error: "saleId requerido" }, { status: 400 });
      }
      const sIdx = sales.findIndex((s) => s && s.id === saleId);
      if (sIdx < 0) {
        return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
      }
      if (!isEfectivoSale(sales[sIdx])) {
        return NextResponse.json(
          { error: "Solo se pueden borrar tickets en efectivo" },
          { status: 403 },
        );
      }
      sales.splice(sIdx, 1);
    } else if (action === "updatesale") {
      const rawSale = (body.sale || {}) as CierreSale;
      const saleId = String(rawSale.id || body.saleId || "").slice(0, 64);
      if (!saleId) {
        return NextResponse.json({ error: "sale.id requerido" }, { status: 400 });
      }
      const sIdx = sales.findIndex((s) => s && s.id === saleId);
      if (sIdx < 0) {
        return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
      }
      if (!isEfectivoSale(sales[sIdx])) {
        return NextResponse.json(
          { error: "Solo se pueden editar tickets en efectivo" },
          { status: 403 },
        );
      }
      const prev = sales[sIdx];
      const next = normalizeEditedSale({
        ...prev,
        ...rawSale,
        id: saleId,
        at: Number(rawSale.at) || prev.at || Date.now(),
        mesa: String(rawSale.mesa ?? prev.mesa ?? "").slice(0, 40),
        paymentMethod: "efectivo",
        waiterId: rawSale.waiterId ?? prev.waiterId ?? null,
        waiterName: rawSale.waiterName ?? prev.waiterName ?? null,
      });
      if (!next.lines?.length) {
        sales.splice(sIdx, 1);
      } else {
        sales[sIdx] = next;
      }
    } else if (action === "updateline") {
      const saleId = String(body.saleId || "").slice(0, 64);
      const lineId = String(body.lineId || body.productId || "").slice(0, 80);
      if (!saleId || !lineId) {
        return NextResponse.json(
          { error: "saleId y lineId requeridos" },
          { status: 400 },
        );
      }
      const sIdx = sales.findIndex((s) => s && s.id === saleId);
      if (sIdx < 0) {
        return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
      }
      if (!isEfectivoSale(sales[sIdx])) {
        return NextResponse.json(
          { error: "Solo se pueden editar tickets en efectivo" },
          { status: 403 },
        );
      }
      const sale = {
        ...sales[sIdx],
        lines: (sales[sIdx].lines || []).slice(),
      };
      const li = sale.lines!.findIndex((l) => l && String(l.id) === lineId);
      if (li < 0) {
        return NextResponse.json(
          { error: "Producto no encontrado en el ticket" },
          { status: 404 },
        );
      }
      const hasQty = body.qty !== undefined && body.qty !== null && body.qty !== "";
      const hasPrice =
        body.price !== undefined && body.price !== null && body.price !== "";
      let qty = hasQty ? Number(body.qty) : Number(sale.lines![li].qty);
      let price = hasPrice ? Number(body.price) : Number(sale.lines![li].price);
      if (!Number.isFinite(qty) || qty < 0) qty = 0;
      if (!Number.isFinite(price) || price < 0) price = 0;
      if (qty <= 0) {
        sale.lines!.splice(li, 1);
      } else {
        sale.lines![li] = {
          ...sale.lines![li],
          qty: Math.round(qty),
          price: round2(price),
        };
      }
      if (!sale.lines!.length) {
        sales.splice(sIdx, 1);
      } else {
        sales[sIdx] = normalizeEditedSale({
          ...sale,
          paymentMethod: "efectivo",
        });
      }
    }

    cierre = recomputeCierreFromSales({ ...cierre, sales });
    items[idx] = cierre;
    const nextStore: CierresStore = {
      kind: "casa-torino-cierres",
      items,
      updatedAt: Date.now(),
    };
    await saveCierresStore(nextStore);
    await syncEndedJornada(cierre);

    const response = buildCierresResponse(nextStore, month || cierre.monthKey);
    return NextResponse.json({
      ok: true,
      cierre,
      ...response,
    });
  } catch (err) {
    console.error("[erp/api/cierres POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al guardar" },
      { status: 500 },
    );
  }
}
