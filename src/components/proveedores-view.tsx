"use client";

import { useEffect, useMemo, useState } from "react";
import { Truck } from "lucide-react";
import { MonthSelector } from "@/components/month-selector";
import { createClient } from "@/lib/supabase/client";
import {
  labelMes,
  mesActualKey,
  rangoMes,
  type MesKey,
} from "@/lib/meses";

type ProveedorRow = {
  nombre: string;
  total: number;
  movimientos: number;
};

function formatImporte(n: number) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export function ProveedoresView() {
  const [mesKey, setMesKey] = useState<MesKey>(() => mesActualKey());
  const [rows, setRows] = useState<ProveedorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const { inicioISO, finISO } = rangoMes(mesKey);
      const supabase = createClient();

      const { data, error: qError } = await supabase
        .from("gastos")
        .select("proveedor_nombre, importe")
        .gte("created_at", inicioISO)
        .lte("created_at", finISO)
        .not("proveedor_nombre", "is", null);

      if (cancelled) return;

      if (qError) {
        setError(qError.message);
        setRows([]);
      } else {
        const mapa = new Map<string, { total: number; movimientos: number }>();
        for (const g of data ?? []) {
          const nombre = (g.proveedor_nombre ?? "").trim();
          if (!nombre) continue;
          const prev = mapa.get(nombre) ?? { total: 0, movimientos: 0 };
          prev.total += Number(g.importe);
          prev.movimientos += 1;
          mapa.set(nombre, prev);
        }
        const list = [...mapa.entries()]
          .map(([nombre, v]) => ({
            nombre,
            total: v.total,
            movimientos: v.movimientos,
          }))
          .sort((a, b) => b.total - a.total);
        setRows(list);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [mesKey]);

  const totalMes = useMemo(
    () => rows.reduce((s, r) => s + r.total, 0),
    [rows],
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl text-ink">Proveedores</h1>
        <p className="mt-1 text-sm text-ink/55">
          Gasto agrupado · {labelMes(mesKey)}
        </p>
      </header>

      <MonthSelector value={mesKey} onChange={setMesKey} id="proveedores-mes" />

      {loading ? (
        <p className="text-sm text-ink/50">Cargando…</p>
      ) : error ? (
        <p className="rounded-tpv bg-rojo-colombia/10 px-4 py-3 text-sm text-rojo-colombia">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-tpv-lg bg-card px-6 py-10 text-center shadow-tpv">
          <Truck className="mx-auto size-8 text-ink/30" aria-hidden />
          <p className="mt-3 font-display text-lg text-ink">
            Sin proveedores este mes
          </p>
          <p className="mt-1 text-sm text-ink/55">
            Indica el proveedor al registrar un gasto para ver el ranking aquí.
          </p>
        </div>
      ) : (
        <>
          <article className="rounded-tpv-lg bg-card p-5 shadow-tpv">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
              Total proveedores
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-ink">
              {formatImporte(totalMes)}
            </p>
          </article>

          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li
                key={r.nombre}
                className="flex items-center justify-between gap-3 rounded-tpv-lg bg-card p-4 shadow-tpv"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{r.nombre}</p>
                  <p className="text-xs text-ink/50">
                    {r.movimientos} movimiento{r.movimientos === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="shrink-0 font-display text-xl font-bold text-ink">
                  {formatImporte(r.total)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
