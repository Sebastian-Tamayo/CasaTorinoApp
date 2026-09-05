"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CategoriaGasto, Gasto } from "@/types/database";

function formatImporte(importe: number) {
  return Number(importe).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfLocalMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

type CategoriaTotal = {
  categoria: CategoriaGasto;
  total: number;
  porcentaje: number;
};

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <p className="text-sm font-medium text-ink/50">Cargando…</p>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-tpv-lg bg-card p-5 shadow-tpv"
          >
            <div className="h-3 w-40 rounded bg-ink/10" />
            <div className="mt-4 h-10 w-36 rounded bg-ink/10" />
          </div>
        ))}
      </div>
      <div className="animate-pulse rounded-tpv-lg bg-card p-4 shadow-tpv">
        <div className="h-4 w-44 rounded bg-ink/10" />
        <div className="mt-4 flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="mb-2 flex justify-between">
                <div className="h-3 w-24 rounded bg-ink/10" />
                <div className="h-3 w-16 rounded bg-ink/10" />
              </div>
              <div className="h-2 w-full rounded-full bg-ink/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  importe,
  accent,
}: {
  label: string;
  importe: number;
  accent?: "oro" | "default";
}) {
  return (
    <article className="rounded-tpv-lg bg-card p-5 shadow-tpv">
      <p className="font-sans text-xs font-semibold uppercase tracking-wide text-ink/50">
        {label}
      </p>
      <p
        className={`mt-3 font-display text-4xl font-bold leading-none tracking-tight ${
          accent === "oro" ? "text-oro" : "text-ink"
        }`}
      >
        {formatImporte(importe)}
      </p>
    </article>
  );
}

function DesgloseCategorias({ items }: { items: CategoriaTotal[] }) {
  if (items.length === 0) {
    return (
      <section className="rounded-tpv-lg bg-card px-6 py-10 text-center shadow-tpv">
        <p className="font-display text-xl text-ink">Sin gastos este mes</p>
        <p className="mt-2 text-sm text-ink/55">
          Cuando registres movimientos, verás aquí el desglose por categoría.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-tpv-lg bg-card p-4 shadow-tpv">
      <h2 className="font-display text-lg text-ink">Por categoría</h2>
      <p className="mt-0.5 font-sans text-xs text-ink/50">
        Mes en curso · % sobre el total acumulado
      </p>

      <ul className="mt-4 flex flex-col gap-4">
        {items.map(({ categoria, total, porcentaje }) => (
          <li key={categoria}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="font-sans text-sm font-medium text-ink">
                {categoria}
              </span>
              <span className="shrink-0 font-display text-base font-bold text-ink">
                {formatImporte(total)}
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-cream"
              role="progressbar"
              aria-valuenow={Math.round(porcentaje)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${categoria}: ${Math.round(porcentaje)}%`}
            >
              <div
                className="h-full rounded-full bg-esmeralda transition-[width] duration-500"
                style={{ width: `${Math.max(porcentaje, porcentaje > 0 ? 4 : 0)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DashboardInicio() {
  const [gastosMes, setGastosMes] = useState<
    Pick<Gasto, "importe" | "categoria" | "created_at">[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mesLabel = useMemo(
    () =>
      new Date().toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const now = new Date();
      const desde = startOfLocalMonth(now).toISOString();

      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("gastos")
        .select("importe, categoria, created_at")
        .gte("created_at", desde)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setGastosMes([]);
      } else {
        setGastosMes(data ?? []);
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { totalMes, totalHoy, porCategoria } = useMemo(() => {
    const inicioHoy = startOfLocalDay(new Date()).getTime();

    let mes = 0;
    let hoy = 0;
    const mapa = new Map<CategoriaGasto, number>();

    for (const g of gastosMes) {
      const importe = Number(g.importe);
      mes += importe;

      if (new Date(g.created_at).getTime() >= inicioHoy) {
        hoy += importe;
      }

      mapa.set(g.categoria, (mapa.get(g.categoria) ?? 0) + importe);
    }

    const desglose: CategoriaTotal[] = [...mapa.entries()]
      .map(([categoria, total]) => ({
        categoria,
        total,
        porcentaje: mes > 0 ? (total / mes) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return { totalMes: mes, totalHoy: hoy, porCategoria: desglose };
  }, [gastosMes]);

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="font-display text-2xl text-ink">Inicio</h1>
          <p className="mt-1 font-sans text-sm capitalize text-ink/55">
            {mesLabel}
          </p>
        </header>
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl text-ink">Inicio</h1>
        <p className="mt-1 font-sans text-sm capitalize text-ink/55">
          {mesLabel}
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-tpv bg-rojo-colombia/10 px-4 py-3 text-sm text-rojo-colombia"
        >
          No se pudo cargar el resumen: {error}
        </p>
      ) : null}

      {!error ? (
        <>
          <section className="flex flex-col gap-3" aria-label="Resumen de gastos">
            <KpiCard label="Gasto acumulado del mes" importe={totalMes} />
            <KpiCard label="Gasto de hoy" importe={totalHoy} accent="oro" />
          </section>

          <DesgloseCategorias items={porCategoria} />
        </>
      ) : null}
    </div>
  );
}
