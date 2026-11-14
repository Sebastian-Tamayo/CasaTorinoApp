"use client";

import { useMemo, useState } from "react";
import {
  isEfectivoSale,
  saveCierreSaleEdit,
  type CierreItem,
  type CierreSale,
  type CierreSaleLine,
  type CierresResponse,
} from "@/lib/cierres";
import { round2 } from "@/lib/fiscal";

function formatImporte(importe: number) {
  return round2(Number(importe) || 0).toLocaleString("es-ES", {
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

function paymentLabel(sale: CierreSale) {
  const pm = String(sale.paymentMethod || "efectivo").toLowerCase();
  if (pm === "tarjeta") return "Tarjeta";
  if (pm === "mixto") return "Mixto";
  return "Efectivo";
}

function draftSaleTotal(lines: CierreSaleLine[], tip: number) {
  const linesTotal = round2(
    lines.reduce(
      (a, l) => a + (Math.max(0, Number(l.qty) || 0) * (Number(l.price) || 0)),
      0,
    ),
  );
  return { linesTotal, tip: round2(Math.max(0, tip)), total: linesTotal };
}

type Props = {
  cierre: CierreItem;
  monthKey: string;
  onSaved: (data: CierresResponse & { cierre: CierreItem }) => void;
};

/** Editor de tickets en efectivo dentro de un cierre archivado. */
export function CierreEfectivoEditor({ cierre, monthKey, onSaved }: Props) {
  const sales = Array.isArray(cierre.sales) ? cierre.sales : [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLines, setDraftLines] = useState<CierreSaleLine[]>([]);
  const [draftTip, setDraftTip] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const draft = useMemo(
    () => draftSaleTotal(draftLines, draftTip),
    [draftLines, draftTip],
  );

  function startEdit(sale: CierreSale) {
    if (!isEfectivoSale(sale)) return;
    setEditingId(String(sale.id || ""));
    setDraftLines(
      (sale.lines || []).map((l) => ({
        ...l,
        qty: Number(l.qty) || 0,
        price: Number(l.price) || 0,
      })),
    );
    setDraftTip(Number(sale.tip) || 0);
    setMsg(null);
    setErr(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftLines([]);
    setDraftTip(0);
    setErr(null);
  }

  function setLineQty(i: number, qty: number) {
    setDraftLines((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], qty: Math.max(0, Math.round(qty) || 0) };
      return next;
    });
  }

  function setLinePrice(i: number, price: number) {
    setDraftLines((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], price: Math.max(0, round2(price)) };
      return next;
    });
  }

  function removeLine(i: number) {
    setDraftLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSave(sale: CierreSale) {
    if (!sale.id || saving) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const nextSale: CierreSale = {
        ...sale,
        tip: draftTip,
        lines: draftLines
          .filter((l) => (Number(l.qty) || 0) > 0)
          .map((l) => ({
            ...l,
            qty: Math.max(0, Math.round(Number(l.qty) || 0)),
            price: round2(Number(l.price) || 0),
          })),
        paymentMethod: "efectivo",
      };
      const data = await saveCierreSaleEdit({
        action: "updateSale",
        cierreId: cierre.id,
        month: monthKey,
        sale: nextSale,
      });
      setMsg("Guardado. Totales actualizados.");
      setEditingId(null);
      onSaved(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(sale: CierreSale) {
    if (!sale.id || saving) return;
    if (
      !window.confirm(
        `¿Borrar el ticket de mesa ${sale.mesa || "—"} (${formatImporte(Number(sale.total) || 0)})?`,
      )
    ) {
      return;
    }
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const data = await saveCierreSaleEdit({
        action: "deleteSale",
        cierreId: cierre.id,
        month: monthKey,
        saleId: sale.id,
      });
      setMsg("Ticket borrado. Totales actualizados.");
      setEditingId(null);
      onSaved(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al borrar");
    } finally {
      setSaving(false);
    }
  }

  if (!sales.length) {
    return (
      <p className="mt-3 text-xs text-ink/45">
        Este cierre no tiene detalle de tickets (dato antiguo o vacío).
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-ink/5 pt-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-oro">
        Tickets · editar efectivo
      </p>
      <p className="mb-3 text-[11px] text-ink/50">
        Solo mesas cobradas en efectivo. Al guardar se recalculan los totales
        del cierre y del mes.
      </p>
      {msg ? (
        <p className="mb-2 rounded-tpv bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="mb-2 rounded-tpv bg-rojo-colombia/10 px-3 py-2 text-xs text-rojo-colombia">
          {err}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {sales.map((sale) => {
          const id = String(sale.id || "");
          const cash = isEfectivoSale(sale);
          const editing = editingId === id;
          return (
            <li
              key={id || `${sale.mesa}-${sale.at}`}
              className="rounded-tpv border border-ink/10 bg-cream/40 px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-ink">
                    Mesa {sale.mesa || "—"}
                    <span className="ml-2 text-xs font-normal text-ink/50">
                      {fmtHm(sale.at)} · {paymentLabel(sale)}
                      {sale.waiterName ? ` · ${sale.waiterName}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-ink/55">
                    {editing
                      ? `Borrador ${formatImporte(draft.total)}`
                      : formatImporte(Number(sale.total) || 0)}
                    {(Number(sale.tip) || 0) > 0 && !editing
                      ? ` · propina ${formatImporte(Number(sale.tip) || 0)}`
                      : null}
                  </p>
                </div>
                {cash ? (
                  <div className="flex gap-2">
                    {!editing ? (
                      <>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => startEdit(sale)}
                          className="rounded-tpv bg-ink px-3 py-1.5 text-xs font-bold text-cream disabled:opacity-45"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void onDelete(sale)}
                          className="rounded-tpv border border-rojo-colombia/40 px-3 py-1.5 text-xs font-bold text-rojo-colombia disabled:opacity-45"
                        >
                          Borrar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void onSave(sale)}
                          className="rounded-tpv bg-oro px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-45"
                        >
                          {saving ? "Guardando…" : "Guardar"}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={cancelEdit}
                          className="rounded-tpv border border-ink/20 px-3 py-1.5 text-xs font-bold text-ink/70 disabled:opacity-45"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                    Solo lectura
                  </span>
                )}
              </div>

              {editing ? (
                <div className="mt-2 space-y-2">
                  {draftLines.map((line, i) => (
                    <div
                      key={`${line.id}-${i}`}
                      className="grid grid-cols-[1fr_4.5rem_5.5rem_auto] items-center gap-2"
                    >
                      <span className="truncate text-xs text-ink">
                        {line.name || line.id || "Producto"}
                      </span>
                      <label className="text-[10px] text-ink/45">
                        Ud.
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={Number(line.qty) || 0}
                          onChange={(e) =>
                            setLineQty(i, Number(e.target.value))
                          }
                          className="mt-0.5 w-full rounded border border-ink/15 bg-white px-1.5 py-1 text-sm"
                        />
                      </label>
                      <label className="text-[10px] text-ink/45">
                        Precio
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={Number(line.price) || 0}
                          onChange={(e) =>
                            setLinePrice(i, Number(e.target.value))
                          }
                          className="mt-0.5 w-full rounded border border-ink/15 bg-white px-1.5 py-1 text-sm"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="self-end pb-1 text-[11px] font-semibold text-rojo-colombia"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <label className="flex max-w-[10rem] flex-col text-[10px] text-ink/45">
                    Propina (€)
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={draftTip}
                      onChange={(e) =>
                        setDraftTip(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="mt-0.5 rounded border border-ink/15 bg-white px-1.5 py-1 text-sm"
                    />
                  </label>
                  <p className="text-xs font-bold text-ink">
                    Total ticket: {formatImporte(draft.total)}
                    {draft.tip > 0
                      ? ` · propina ${formatImporte(draft.tip)}`
                      : ""}
                  </p>
                </div>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {(sale.lines || []).map((l, i) => (
                    <li key={`${l.id}-${i}`} className="text-xs text-ink/65">
                      {l.qty} × {l.name || l.id}:{" "}
                      {formatImporte(
                        round2((Number(l.qty) || 0) * (Number(l.price) || 0)),
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
