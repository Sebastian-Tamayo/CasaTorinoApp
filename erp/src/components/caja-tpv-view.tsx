"use client";

import { useEffect, useState } from "react";
import { MonthSelector } from "@/components/month-selector";
import { fetchCierres, type CierreItem } from "@/lib/cierres";
import { labelMes, mesActualKey, type MesKey } from "@/lib/meses";

function formatImporte(importe: number) {
  return Number(importe).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

function fmtHm(ts?: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CajaTpvView() {
  const [mesKey, setMesKey] = useState<MesKey>(() => mesActualKey());
  const [items, setItems] = useState<CierreItem[]>([]);
  const [total, setTotal] = useState(0);
  const [tickets, setTickets] = useState(0);
  const [comida, setComida] = useState(0);
  const [bebida, setBebida] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCierres(mesKey);
        if (cancelled) return;
        setItems(data.items || []);
        setTotal(data.monthTotals?.total || 0);
        setTickets(data.monthTotals?.tickets || 0);
        setComida(data.monthTotals?.byType?.comida?.total || 0);
        setBebida(data.monthTotals?.byType?.bebida?.total || 0);
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
        </p>
      </article>

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
