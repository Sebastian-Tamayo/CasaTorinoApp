"use client";

import { useEffect, useState } from "react";
import { MonthSelector } from "@/components/month-selector";
import { fetchCierres, type CierreItem } from "@/lib/cierres";
import { round2 } from "@/lib/fiscal";
import { labelMes, mesActualKey, type MesKey } from "@/lib/meses";
import {
  loadTopVentas,
  type TopPeriodo,
  type TopProducto,
} from "@/lib/top-ventas";

function formatImporte(importe: number) {
  return round2(Number(importe) || 0).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

function formatQty(qty: number) {
  const n = Number(qty) || 0;
  return Number.isInteger(n)
    ? String(n)
    : n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

function fmtHm(ts?: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PaymentTipTotals = {
  byPayment?: {
    efectivo?: { total?: number; tickets?: number };
    tarjeta?: { total?: number; tickets?: number };
  };
  tipTotal?: number;
};

function showCierrePaymentTip(totals?: CierreItem["totals"]) {
  if (!totals) return false;
  if ((totals.tipTotal ?? 0) > 0) return true;
  if ((totals.byPayment?.tarjeta?.total ?? 0) > 0) return true;
  return totals.byPayment != null;
}

function paymentTipLine(totals?: PaymentTipTotals | null) {
  if (!totals?.byPayment && !(totals?.tipTotal && totals.tipTotal > 0))
    return null;
  const ef = round2(totals.byPayment?.efectivo?.total ?? 0);
  const tj = round2(totals.byPayment?.tarjeta?.total ?? 0);
  const tip = round2(totals.tipTotal ?? 0);
  return (
    <>
      {" · Efectivo "}
      {formatImporte(ef)}
      {" · Tarjeta "}
      {formatImporte(tj)}
      {tip > 0 ? <> · Propina {formatImporte(tip)}</> : null}
    </>
  );
}

const TOP_PERIODOS: { id: TopPeriodo; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "trimestre", label: "Trimestre" },
];

export function CajaTpvView() {
  const [mesKey, setMesKey] = useState<MesKey>(() => mesActualKey());
  const [items, setItems] = useState<CierreItem[]>([]);
  const [total, setTotal] = useState(0);
  const [tickets, setTickets] = useState(0);
  const [comida, setComida] = useState(0);
  const [bebida, setBebida] = useState(0);
  const [monthPayment, setMonthPayment] = useState<PaymentTipTotals | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const [topPeriodo, setTopPeriodo] = useState<TopPeriodo>("hoy");
  const [topProducts, setTopProducts] = useState<TopProducto[]>([]);
  const [topLabel, setTopLabel] = useState("Hoy");
  const [topTickets, setTopTickets] = useState(0);
  const [topTotal, setTopTotal] = useState(0);
  const [topOpenJornada, setTopOpenJornada] = useState(false);
  const [topLoading, setTopLoading] = useState(true);
  const [topError, setTopError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCierres(mesKey);
        if (cancelled) return;
        setItems(data.items || []);
        setTotal(round2(data.monthTotals?.total || 0));
        setTickets(data.monthTotals?.tickets || 0);
        setComida(round2(data.monthTotals?.byType?.comida?.total || 0));
        setBebida(round2(data.monthTotals?.byType?.bebida?.total || 0));
        setMonthPayment(
          data.monthTotals?.byPayment
            ? {
                byPayment: {
                  efectivo: {
                    total: round2(
                      data.monthTotals.byPayment.efectivo?.total ?? 0,
                    ),
                    tickets: data.monthTotals.byPayment.efectivo?.tickets ?? 0,
                  },
                  tarjeta: {
                    total: round2(
                      data.monthTotals.byPayment.tarjeta?.total ?? 0,
                    ),
                    tickets: data.monthTotals.byPayment.tarjeta?.tickets ?? 0,
                  },
                },
                tipTotal: round2(data.monthTotals.tipTotal ?? 0),
              }
            : null,
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [mesKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadTop() {
      setTopLoading(true);
      setTopError(null);
      try {
        const data = await loadTopVentas(topPeriodo);
        if (cancelled) return;
        setTopProducts(data.products || []);
        setTopLabel(data.label);
        setTopTickets(data.tickets || 0);
        setTopTotal(round2(data.total || 0));
        setTopOpenJornada(Boolean(data.fromOpenJornada));
      } catch (err) {
        if (!cancelled) {
          setTopError(
            err instanceof Error ? err.message : "Error al cargar top ventas",
          );
          setTopProducts([]);
        }
      } finally {
        if (!cancelled) setTopLoading(false);
      }
    }
    void loadTop();
    return () => {
      cancelled = true;
    };
  }, [topPeriodo]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-oro">
          Ingreso diario oficial
        </p>
        <h1 className="mt-1 font-display text-2xl text-ink">Caja TPV</h1>
        <p className="mt-1 text-sm text-ink/55">
          Historial de cierres · {labelMes(mesKey)}. El mes se reinicia en el
          selector; el historial no se borra.
        </p>
      </header>

      <MonthSelector value={mesKey} onChange={setMesKey} id="caja-mes" />

      <article className="rounded-tpv-lg border-2 border-oro/35 bg-card p-5 shadow-tpv">
        <p className="text-xs font-bold uppercase tracking-wide text-ink/50">
          Total mes
        </p>
        <p className="mt-2 font-display text-4xl font-bold">{formatImporte(total)}</p>
        <p className="mt-2 text-xs text-ink/50">
          {tickets} tickets · Comida {formatImporte(comida)} · Bebida{" "}
          {formatImporte(bebida)}
          {paymentTipLine(monthPayment)}
        </p>
      </article>

      <section className="flex flex-col gap-3" aria-labelledby="top-ventas-title">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-oro">
            Ranking
          </p>
          <h2 id="top-ventas-title" className="mt-1 font-display text-xl text-ink">
            Productos más vendidos
          </h2>
          <p className="mt-1 text-sm text-ink/55">
            {topLabel}
            {topOpenJornada ? " · incluye caja abierta (tiempo real)" : ""}
          </p>
        </header>

        <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Periodo top ventas">
          {TOP_PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={topPeriodo === p.id}
              onClick={() => setTopPeriodo(p.id)}
              className={`min-h-touch rounded-tpv text-sm font-bold transition active:scale-[0.98] ${
                topPeriodo === p.id
                  ? "bg-oro text-ink"
                  : "bg-card text-ink shadow-tpv"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {topLoading ? (
          <p className="text-sm text-ink/50">Cargando ranking…</p>
        ) : topError ? (
          <p className="rounded-tpv bg-rojo-colombia/10 px-4 py-3 text-sm text-rojo-colombia">
            {topError}
          </p>
        ) : (
          <article className="overflow-hidden rounded-tpv-lg bg-card shadow-tpv">
            <div className="border-b border-ink/5 px-4 py-3 text-xs text-ink/50">
              {topTickets} tickets · {formatImporte(topTotal)}
            </div>
            {topProducts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink/50">
                Sin ventas en este periodo.
              </p>
            ) : (
              <ol className="divide-y divide-ink/5">
                {topProducts.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-3 text-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-oro/15 text-xs font-extrabold text-oro">
                      {i + 1}º
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-ink">
                        {p.name}
                      </span>
                      <span className="block text-xs text-ink/50">
                        {formatQty(p.qty)} uds
                      </span>
                    </span>
                    <span className="shrink-0 font-display text-base font-bold text-ink">
                      {formatImporte(p.total)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </article>
        )}
      </section>

      {loading ? (
        <p className="text-sm text-ink/50">Cargando…</p>
      ) : error ? (
        <p className="rounded-tpv bg-rojo-colombia/10 px-4 py-3 text-sm text-rojo-colombia">
          {error}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.length === 0 ? (
            <li className="rounded-tpv bg-card px-4 py-6 text-center text-sm text-ink/50 shadow-tpv">
              Sin cierres en este mes.
            </li>
          ) : (
            items.map((c) => {
              const open = openId === c.id;
              return (
                <li key={c.id} className="overflow-hidden rounded-tpv-lg bg-card shadow-tpv">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : c.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block text-sm font-bold text-ink">
                        {c.dayKey}
                      </span>
                      <span className="block text-xs text-ink/50">
                        {fmtHm(c.startedAt)} – {fmtHm(c.endedAt)} ·{" "}
                        {c.totals?.tickets || 0} tickets
                      </span>
                    </span>
                    <span className="font-display text-xl font-bold">
                      {formatImporte(c.totals?.total || 0)}
                    </span>
                  </button>
                  {open ? (
                    <div className="border-t border-ink/5 px-4 py-3 text-sm">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-oro">
                        Desglose
                      </p>
                      <p>
                        Comida:{" "}
                        {formatImporte(c.totals?.byType?.comida?.total || 0)}
                      </p>
                      <p>
                        Bebida:{" "}
                        {formatImporte(c.totals?.byType?.bebida?.total || 0)}
                      </p>
                      {showCierrePaymentTip(c.totals) ? (
                        <>
                          <p>
                            Efectivo:{" "}
                            {formatImporte(
                              c.totals?.byPayment?.efectivo?.total || 0,
                            )}
                          </p>
                          <p>
                            Tarjeta:{" "}
                            {formatImporte(
                              c.totals?.byPayment?.tarjeta?.total || 0,
                            )}
                          </p>
                          {(c.totals?.tipTotal ?? 0) > 0 ? (
                            <p>
                              Propina:{" "}
                              {formatImporte(c.totals?.tipTotal ?? 0)}
                            </p>
                          ) : null}
                        </>
                      ) : null}
                      {(c.totals?.byProduct || []).slice(0, 12).map((p) => (
                        <p key={p.id} className="mt-1 text-ink/70">
                          {p.qty} × {p.name}: {formatImporte(p.total)}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
