"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard } from "lucide-react";
import { MonthSelector } from "@/components/month-selector";
import { createClient } from "@/lib/supabase/client";
import { onMovimientosChanged } from "@/lib/movimientos-events";
import {
  esMesActual,
  labelMes,
  mesActualKey,
  rangoMes,
  type MesKey,
} from "@/lib/meses";
import type { CategoriaGasto, Gasto, Ingreso, MetodoPago } from "@/types/database";

function formatImporte(importe: number) {
  return Number(importe).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-tpv-lg bg-card p-5 shadow-tpv"
          >
            <div className="h-3 w-40 rounded bg-ink/10" />
            <div className="mt-4 h-10 w-36 rounded bg-ink/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  importe,
  hint,
  accent = "default",
}: {
  label: string;
  importe: number;
  hint?: string;
  accent?: "default" | "ingreso" | "gasto" | "neto";
}) {
  const amountClass =
    accent === "ingreso"
      ? "text-esmeralda"
      : accent === "gasto"
        ? "text-rojo-colombia"
        : accent === "neto"
          ? importe >= 0
            ? "text-azul-colombia"
            : "text-rojo-colombia"
          : "text-ink";

  return (
    <article className="rounded-tpv-lg bg-card p-5 shadow-tpv">
      <p className="font-sans text-xs font-semibold uppercase tracking-wide text-ink/50">
        {label}
      </p>
      <p
        className={`mt-3 font-display text-4xl font-bold leading-none tracking-tight ${amountClass}`}
      >
        {formatImporte(importe)}
      </p>
      {hint ? (
        <p className="mt-2 font-sans text-xs text-ink/50">{hint}</p>
      ) : null}
    </article>
  );
}

function MetodoPagoDesglose({
  efectivo,
  tarjeta,
  total,
}: {
  efectivo: number;
  tarjeta: number;
  total: number;
}) {
  const pctEfectivo = total > 0 ? (efectivo / total) * 100 : 0;
  const pctTarjeta = total > 0 ? (tarjeta / total) * 100 : 0;

  return (
    <section className="rounded-tpv-lg bg-card p-4 shadow-tpv">
      <h2 className="font-display text-lg text-ink">Ingresos por método</h2>
      <p className="mt-0.5 font-sans text-xs text-ink/50">
        Mes en curso · efectivo vs tarjeta
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-ink">
              <Banknote className="size-4 text-oro" aria-hidden />
              Efectivo
            </span>
            <span className="font-display text-base font-bold text-ink">
              {formatImporte(efectivo)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream">
            <div
              className="h-full rounded-full bg-oro transition-[width] duration-500"
              style={{
                width: `${Math.max(pctEfectivo, pctEfectivo > 0 ? 4 : 0)}%`,
              }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-ink">
              <CreditCard className="size-4 text-azul-asturias" aria-hidden />
              Tarjeta
            </span>
            <span className="font-display text-base font-bold text-ink">
              {formatImporte(tarjeta)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream">
            <div
              className="h-full rounded-full bg-azul-asturias transition-[width] duration-500"
              style={{
                width: `${Math.max(pctTarjeta, pctTarjeta > 0 ? 4 : 0)}%`,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function DesgloseCategoriasGasto({ items }: { items: CategoriaTotal[] }) {
  if (items.length === 0) {
    return (
      <section className="rounded-tpv-lg bg-card px-6 py-8 text-center shadow-tpv">
        <p className="font-display text-lg text-ink">Sin gastos este mes</p>
        <p className="mt-1 text-sm text-ink/55">
          El desglose por categoría aparecerá al registrar salidas.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-tpv-lg bg-card p-4 shadow-tpv">
      <h2 className="font-display text-lg text-ink">Gastos por categoría</h2>
      <p className="mt-0.5 font-sans text-xs text-ink/50">
        Mes en curso · % sobre gastos
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
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream">
              <div
                className="h-full rounded-full bg-rojo-colombia/80 transition-[width] duration-500"
                style={{
                  width: `${Math.max(porcentaje, porcentaje > 0 ? 4 : 0)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DashboardInicio() {
  const [mesKey, setMesKey] = useState<MesKey>(() => mesActualKey());
  const [refreshTick, setRefreshTick] = useState(0);
  const [gastosMes, setGastosMes] = useState<
    Pick<Gasto, "importe" | "categoria" | "created_at">[]
  >([]);
  const [ingresosMes, setIngresosMes] = useState<
    Pick<Ingreso, "importe" | "metodo_pago" | "created_at">[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mesLabel = useMemo(() => labelMes(mesKey), [mesKey]);
  const mesEsActual = esMesActual(mesKey);

  useEffect(() => onMovimientosChanged(() => setRefreshTick((t) => t + 1)), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { inicioISO, finISO } = rangoMes(mesKey);
      const supabase = createClient();

      const [gastosRes, ingresosRes] = await Promise.all([
        supabase
          .from("gastos")
          .select("importe, categoria, created_at")
          .gte("created_at", inicioISO)
          .lte("created_at", finISO)
          .order("created_at", { ascending: false }),
        supabase
          .from("ingresos")
          .select("importe, metodo_pago, created_at")
          .gte("created_at", inicioISO)
          .lte("created_at", finISO)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      if (gastosRes.error || ingresosRes.error) {
        setError(
          gastosRes.error?.message ??
            ingresosRes.error?.message ??
            "Error al cargar datos",
        );
        setGastosMes([]);
        setIngresosMes([]);
      } else {
        setGastosMes(gastosRes.data ?? []);
        setIngresosMes(ingresosRes.data ?? []);
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [mesKey, refreshTick]);

  const stats = useMemo(() => {
    const inicioHoy = startOfLocalDay(new Date()).getTime();

    let ingresosMesTotal = 0;
    let ingresosHoy = 0;
    let efectivo = 0;
    let tarjeta = 0;

    for (const i of ingresosMes) {
      const importe = Number(i.importe);
      ingresosMesTotal += importe;
      if (mesEsActual && new Date(i.created_at).getTime() >= inicioHoy) {
        ingresosHoy += importe;
      }
      const metodo = i.metodo_pago as MetodoPago;
      if (metodo === "efectivo") efectivo += importe;
      else tarjeta += importe;
    }

    let gastosMesTotal = 0;
    const mapa = new Map<CategoriaGasto, number>();

    for (const g of gastosMes) {
      const importe = Number(g.importe);
      gastosMesTotal += importe;
      mapa.set(g.categoria, (mapa.get(g.categoria) ?? 0) + importe);
    }

    const porCategoria: CategoriaTotal[] = [...mapa.entries()]
      .map(([categoria, total]) => ({
        categoria,
        total,
        porcentaje: gastosMesTotal > 0 ? (total / gastosMesTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      ingresosMesTotal,
      ingresosHoy,
      gastosMesTotal,
      balance: ingresosMesTotal - gastosMesTotal,
      efectivo,
      tarjeta,
      porCategoria,
    };
  }, [gastosMes, ingresosMes, mesEsActual]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl text-ink">Inicio</h1>
        <p className="mt-1 font-sans text-sm text-ink/55">
          Control de cajas · {mesLabel}
        </p>
      </header>

      <MonthSelector value={mesKey} onChange={setMesKey} id="dashboard-mes" />

      {loading ? <DashboardSkeleton /> : null}

      {!loading && error ? (
        <p
          role="alert"
          className="rounded-tpv bg-rojo-colombia/10 px-4 py-3 text-sm text-rojo-colombia"
        >
          No se pudo cargar el resumen: {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="flex flex-col gap-3" aria-label="KPIs del mes">
            <KpiCard
              label="Total ingresos del mes"
              importe={stats.ingresosMesTotal}
              hint={
                mesEsActual
                  ? `Hoy: ${formatImporte(stats.ingresosHoy)}`
                  : undefined
              }
              accent="ingreso"
            />
            <KpiCard
              label="Total gastos del mes"
              importe={stats.gastosMesTotal}
              accent="gasto"
            />
            <KpiCard
              label="Balance / Neto"
              importe={stats.balance}
              hint="Ingresos − Gastos"
              accent="neto"
            />
          </section>

          <MetodoPagoDesglose
            efectivo={stats.efectivo}
            tarjeta={stats.tarjeta}
            total={stats.ingresosMesTotal}
          />

          <DesgloseCategoriasGasto items={stats.porCategoria} />
        </>
      ) : null}
    </div>
  );
}
