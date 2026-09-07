"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cuotaIva } from "@/lib/fiscal";

type Trimestre = 1 | 2 | 3 | 4;

function trimestreActual(now = new Date()): Trimestre {
  return (Math.floor(now.getMonth() / 3) + 1) as Trimestre;
}

function rangoTrimestre(year: number, q: Trimestre) {
  const startMonth = (q - 1) * 3;
  const inicio = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const fin = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { inicioISO: inicio.toISOString(), finISO: fin.toISOString() };
}

function formatImporte(n: number) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export function FiscalView() {
  const year = new Date().getFullYear();
  const [q, setQ] = useState<Trimestre>(() => trimestreActual());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ivaVentas, setIvaVentas] = useState(0);
  const [ivaCompras, setIvaCompras] = useState(0);
  const [irpfNominas, setIrpfNominas] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const { inicioISO, finISO } = rangoTrimestre(year, q);
      const supabase = createClient();

      const [ingresosRes, gastosRes, nominasRes] = await Promise.all([
        supabase
          .from("ingresos")
          .select("base_imponible, porcentaje_iva")
          .gte("created_at", inicioISO)
          .lte("created_at", finISO),
        supabase
          .from("gastos")
          .select("base_imponible, porcentaje_iva")
          .gte("created_at", inicioISO)
          .lte("created_at", finISO),
        supabase
          .from("nominas_pagadas")
          .select("importe_irpf")
          .gte("mes_anio", inicioISO.slice(0, 10))
          .lte("mes_anio", finISO.slice(0, 10)),
      ]);

      if (cancelled) return;

      if (ingresosRes.error || gastosRes.error || nominasRes.error) {
        setError(
          ingresosRes.error?.message ??
            gastosRes.error?.message ??
            nominasRes.error?.message ??
            "Error fiscal",
        );
        setLoading(false);
        return;
      }

      let ventas = 0;
      for (const i of ingresosRes.data ?? []) {
        ventas += cuotaIva(Number(i.base_imponible), Number(i.porcentaje_iva));
      }

      let compras = 0;
      for (const g of gastosRes.data ?? []) {
        compras += cuotaIva(Number(g.base_imponible), Number(g.porcentaje_iva));
      }

      let irpf = 0;
      for (const n of nominasRes.data ?? []) {
        irpf += Number(n.importe_irpf);
      }

      setIvaVentas(ventas);
      setIvaCompras(compras);
      setIrpfNominas(irpf);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [q, year]);

  const ivaNeto = useMemo(() => ivaVentas - ivaCompras, [ivaVentas, ivaCompras]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl text-ink">Fiscal</h1>
        <p className="mt-1 text-sm text-ink/55">
          Estimación trimestral {year}
        </p>
      </header>

      <div className="grid grid-cols-4 gap-2">
        {([1, 2, 3, 4] as Trimestre[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setQ(t)}
            className={`min-h-touch rounded-tpv text-sm font-bold transition active:scale-[0.98] ${
              q === t
                ? "bg-azul-colombia text-white"
                : "bg-card text-ink shadow-tpv"
            }`}
          >
            Q{t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-ink/50">Cargando…</p>
      ) : error ? (
        <p className="rounded-tpv bg-rojo-colombia/10 px-4 py-3 text-sm text-rojo-colombia">
          {error}
        </p>
      ) : (
        <>
          <section className="rounded-tpv-lg bg-card p-4 shadow-tpv">
            <h2 className="font-display text-lg text-ink">IVA (estimación)</h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink/55">IVA repercutido (ventas)</dt>
                <dd className="font-semibold text-esmeralda">
                  {formatImporte(ivaVentas)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/55">IVA soportado (compras)</dt>
                <dd className="font-semibold text-rojo-colombia">
                  {formatImporte(ivaCompras)}
                </dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-ink/10 pt-3">
                <dt className="font-semibold text-ink">
                  {ivaNeto >= 0 ? "IVA a pagar" : "IVA a devolver"}
                </dt>
                <dd
                  className={`font-display text-2xl font-bold ${
                    ivaNeto >= 0 ? "text-rojo-colombia" : "text-esmeralda"
                  }`}
                >
                  {formatImporte(Math.abs(ivaNeto))}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-tpv-lg bg-card p-4 shadow-tpv">
            <h2 className="font-display text-lg text-ink">
              Retenciones IRPF (nóminas)
            </h2>
            <p className="mt-3 font-display text-3xl font-bold text-azul-colombia">
              {formatImporte(irpfNominas)}
            </p>
            <p className="mt-1 text-xs text-ink/50">
              Total a ingresar en Hacienda (modelo 111 estimado)
            </p>
          </section>
        </>
      )}
    </div>
  );
}
