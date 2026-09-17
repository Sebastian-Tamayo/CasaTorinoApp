"use client";

import { useCallback, useEffect, useState } from "react";
import { MonthSelector } from "@/components/month-selector";
import {
  deleteConsumoSale,
  fetchConsumo,
  setManualTotal,
  updateConsumoLine,
  type ConsumoDay,
} from "@/lib/consumo";
import { labelMes, mesActualKey, type MesKey } from "@/lib/meses";

function formatImporte(importe: number) {
  return Number(importe).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

function effectiveTotal(day: ConsumoDay) {
  if (day.manualTotal != null && Number.isFinite(Number(day.manualTotal))) {
    return Number(day.manualTotal);
  }
  return Number(day.totals?.total) || 0;
}

function fmtHm(ts?: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConsumoMensualView() {
  const [mesKey, setMesKey] = useState<MesKey>(() => mesActualKey());
  const [items, setItems] = useState<ConsumoDay[]>([]);
  const [liveDay, setLiveDay] = useState("");
  const [total, setTotal] = useState(0);
  const [tickets, setTickets] = useState(0);
  const [comida, setComida] = useState(0);
  const [bebida, setBebida] = useState(0);
  const [kitchenQty, setKitchenQty] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editTotal, setEditTotal] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchConsumo(mesKey);
      setItems(data.items || []);
      setLiveDay(data.liveDay || "");
      setTotal(data.monthTotals?.total || 0);
      setTickets(data.monthTotals?.tickets || 0);
      setComida(data.monthTotals?.byType?.comida?.total || 0);
      setBebida(data.monthTotals?.byType?.bebida?.total || 0);
      setKitchenQty(data.monthTotals?.kitchenQty || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [mesKey]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Tiempo real: refresco cada 12s (mismo ritmo que el TPV)
  useEffect(() => {
    const t = setInterval(() => {
      void load();
    }, 12000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!openId) {
      setEditTotal("");
      return;
    }
    const day = items.find((d) => d.dayKey === openId);
    if (day) setEditTotal(String(effectiveTotal(day)));
  }, [openId, items]);

  async function saveManual(dayKey: string) {
    const raw = editTotal.trim();
    const value = raw === "" ? null : Number(raw.replace(",", "."));
    if (value != null && !Number.isFinite(value)) {
      setError("Importe no válido");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setManualTotal(dayKey, value);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function clearManual(dayKey: string) {
    setSaving(true);
    setError(null);
    try {
      await setManualTotal(dayKey, null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function changeLine(
    dayKey: string,
    saleId: string,
    lineId: string,
    patch: { qty?: number; price?: number },
  ) {
    setSaving(true);
    setError(null);
    try {
      await updateConsumoLine(dayKey, saleId, lineId, patch);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo editar");
    } finally {
      setSaving(false);
    }
  }

  async function removeSale(dayKey: string, saleId: string) {
    if (!confirm("¿Borrar este ticket del histórico?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteConsumoSale(dayKey, saleId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-oro">
          Histórico operativo
        </p>
        <h1 className="mt-1 font-display text-2xl text-ink">Consumo mensual</h1>
        <p className="mt-1 text-sm text-ink/55">
          Cobros del TPV en tiempo real + lo servido en cocina ·{" "}
          {labelMes(mesKey)}. Se archiva solo; a las 09:00 se renueva el día.
        </p>
      </header>

      <MonthSelector value={mesKey} onChange={setMesKey} id="consumo-mes" />

      <article className="rounded-tpv-lg border-2 border-oro/35 bg-card p-5 shadow-tpv">
        <p className="text-xs font-bold uppercase tracking-wide text-ink/50">
          Total mes
        </p>
        <p className="mt-2 font-display text-4xl font-bold">
          {formatImporte(total)}
        </p>
        <p className="mt-2 text-xs text-ink/50">
          {tickets} tickets · Comida {formatImporte(comida)} · Bebida{" "}
          {formatImporte(bebida)}
          {kitchenQty > 0 ? ` · Cocina ${kitchenQty} uds` : ""}
        </p>
        {liveDay ? (
          <p className="mt-3 rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-ink/65">
            Día vivo: <span className="text-oro">{liveDay}</span> · se actualiza
            solo con cada cobro del TPV
          </p>
        ) : null}
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
              Sin consumo registrado este mes. Los cobros del TPV aparecerán
              aquí en vivo.
            </li>
          ) : (
            items.map((d) => {
              const open = openId === d.dayKey;
              const isLive = d.dayKey === liveDay || d.status === "live";
              return (
                <li
                  key={d.dayKey}
                  className="overflow-hidden rounded-tpv-lg bg-card shadow-tpv"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : d.dayKey)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block text-sm font-bold text-ink">
                        {d.dayKey}
                        {isLive ? (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-esmeralda">
                            en vivo
                          </span>
                        ) : null}
                        {d.manualTotal != null ? (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-oro">
                            ajustado
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-ink/50">
                        {fmtHm(d.startedAt)} – {fmtHm(d.endedAt)} ·{" "}
                        {d.totals?.tickets || 0} tickets
                        {d.kitchen?.qtyTotal
                          ? ` · cocina ${d.kitchen.qtyTotal}`
                          : ""}
                      </span>
                    </span>
                    <span className="font-display text-xl font-bold">
                      {formatImporte(effectiveTotal(d))}
                    </span>
                  </button>

                  {open ? (
                    <div className="border-t border-ink/5 px-4 py-3 text-sm">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-oro">
                        Total del día (editable)
                      </p>
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editTotal}
                          onChange={(e) => setEditTotal(e.target.value)}
                          className="min-h-11 w-36 rounded-tpv border border-ink/15 bg-cream px-3 font-display text-lg font-bold outline-none focus:ring-2 focus:ring-oro/40"
                          aria-label="Total diario"
                        />
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void saveManual(d.dayKey)}
                          className="min-h-11 rounded-tpv bg-oro px-4 text-sm font-bold text-ink disabled:opacity-50"
                        >
                          Guardar
                        </button>
                        {d.manualTotal != null ? (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void clearManual(d.dayKey)}
                            className="min-h-11 rounded-tpv border border-ink/15 px-3 text-xs font-semibold text-ink/70"
                          >
                            Usar suma real
                          </button>
                        ) : null}
                      </div>

                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink/50">
                        Desglose
                      </p>
                      <p>
                        Comida:{" "}
                        {formatImporte(d.totals?.byType?.comida?.total || 0)}
                      </p>
                      <p>
                        Bebida:{" "}
                        {formatImporte(d.totals?.byType?.bebida?.total || 0)}
                      </p>

                      {(d.kitchen?.items || []).length > 0 ? (
                        <div className="mt-3">
                          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink/50">
                            Cocina (servido)
                          </p>
                          {(d.kitchen?.items || []).slice(0, 20).map((it) => (
                            <p key={it.id} className="text-ink/70">
                              {it.qty} × {it.name}
                            </p>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-oro">
                          Tickets (como en el TPV)
                        </p>
                        {(d.sales || []).length === 0 ? (
                          <p className="text-ink/50">Sin tickets.</p>
                        ) : (
                          (d.sales || [])
                            .slice()
                            .reverse()
                            .map((s) => (
                              <div
                                key={s.id}
                                className="mb-3 rounded-xl border border-ink/8 bg-cream/80 px-3 py-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-ink/60">
                                    Mesa {s.mesa || "—"} · {fmtHm(s.at)}
                                  </span>
                                  <span className="font-display font-bold">
                                    {formatImporte(s.total)}
                                  </span>
                                </div>
                                {(s.lines || []).map((l) => (
                                  <div
                                    key={l.id}
                                    className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-ink/5 pt-2"
                                  >
                                    <span className="min-w-0 flex-1 text-sm">
                                      {l.name}
                                      <span className="block text-[11px] text-ink/45">
                                        {formatImporte(l.price)} ud
                                      </span>
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={saving}
                                        className="size-8 rounded-lg border border-ink/15 text-sm font-bold"
                                        onClick={() =>
                                          void changeLine(
                                            d.dayKey,
                                            s.id,
                                            l.id,
                                            { qty: Math.max(0, l.qty - 1) },
                                          )
                                        }
                                      >
                                        −
                                      </button>
                                      <span className="w-8 text-center font-bold tabular-nums">
                                        {l.qty}
                                      </span>
                                      <button
                                        type="button"
                                        disabled={saving}
                                        className="size-8 rounded-lg border border-ink/15 text-sm font-bold"
                                        onClick={() =>
                                          void changeLine(
                                            d.dayKey,
                                            s.id,
                                            l.id,
                                            { qty: l.qty + 1 },
                                          )
                                        }
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                <div className="mt-2 flex justify-end">
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() =>
                                      void removeSale(d.dayKey, s.id)
                                    }
                                    className="text-xs font-semibold text-rojo-colombia"
                                  >
                                    Borrar ticket
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
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
