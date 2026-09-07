"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Briefcase,
  Calculator,
  CreditCard,
  Truck,
} from "lucide-react";
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
import type { Gasto, Ingreso, MetodoPago } from "@/types/database";

function formatImporte(importe: number) {
  return Number(importe).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function DashboardInicio() {
  const [mesKey, setMesKey] = useState<MesKey>(() => mesActualKey());
  const [refreshTick, setRefreshTick] = useState(0);
  const [gastosMes, setGastosMes] = useState<
    Pick<
      Gasto,
      "importe" | "categoria" | "created_at" | "base_imponible"
    >[]
  >([]);
  const [ingresosMes, setIngresosMes] = useState<
    Pick<Ingreso, "importe" | "metodo_pago" | "created_at" | "base_imponible">[]
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
          .select("importe, categoria, created_at, base_imponible")
          .gte("created_at", inicioISO)
          .lte("created_at", finISO)
          .order("created_at", { ascending: false }),
        supabase
          .from("ingresos")
          .select("importe, metodo_pago, created_at, base_imponible")
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

    let ingresosBase = 0;
    let ingresosHoyBase = 0;
    let efectivo = 0;
    let tarjeta = 0;

    for (const i of ingresosMes) {
      const base = Number(i.base_imponible ?? i.importe);
      ingresosBase += base;
      if (mesEsActual && new Date(i.created_at).getTime() >= inicioHoy) {
        ingresosHoyBase += base;
      }
      const metodo = i.metodo_pago as MetodoPago;
      if (metodo === "efectivo") efectivo += Number(i.importe);
      else tarjeta += Number(i.importe);
    }

    let operativos = 0;
    let laborales = 0;

    for (const g of gastosMes) {
      const base = Number(g.base_imponible ?? g.importe);
      if (g.categoria === "Nóminas y SS") laborales += base;
      else operativos += base;
    }

    const ebitda = ingresosBase - operativos - laborales;

    return {
      ingresosBase,
      ingresosHoyBase,
      operativos,
      laborales,
      ebitda,
      efectivo,
      tarjeta,
      ingresosCobrado: efectivo + tarjeta,
    };
  }, [gastosMes, ingresosMes, mesEsActual]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-azul-colombia">
          ERP · Pérdidas y ganancias
        </p>
        <h1 className="mt-1 font-display text-2xl text-ink">Inicio</h1>
        <p className="mt-1 font-sans text-sm text-ink/55">
          Balance general · {mesLabel}
        </p>
      </header>

      <MonthSelector value={mesKey} onChange={setMesKey} id="dashboard-mes" />

      <nav aria-label="Módulos ERP" className="grid grid-cols-3 gap-2">
        <ModuleLink href="/gestion/proveedores" label="Proveedores" icon={Truck} />
        <ModuleLink href="/gestion/rrhh" label="RRHH" icon={Briefcase} />
        <ModuleLink href="/gestion/fiscal" label="Fiscal" icon={Calculator} />
      </nav>

      <Link
        href="/gestion/mas"
        className="rounded-tpv border border-dashed border-azul-colombia/40 bg-azul-colombia/5 px-4 py-3 text-center text-sm font-semibold text-azul-colombia"
      >
        Ver todos los módulos ERP →
      </Link>

      {loading ? (
        <p className="text-sm text-ink/50">Cargando…</p>
      ) : error ? (
        <p
          role="alert"
          className="rounded-tpv bg-rojo-colombia/10 px-4 py-3 text-sm text-rojo-colombia"
        >
          No se pudo cargar el resumen: {error}
        </p>
      ) : (
        <>
          <section
            className="flex flex-col gap-3"
            aria-label="Pérdidas y ganancias"
          >
            <PgRow
              label="1. Ingresos totales (base imponible)"
              importe={stats.ingresosBase}
              tone="ingreso"
              hint={
                mesEsActual
                  ? `Hoy: ${formatImporte(stats.ingresosHoyBase)}`
                  : undefined
              }
            />
            <PgRow
              label="2. Gastos operativos"
              importe={stats.operativos}
              tone="gasto"
              hint="Proveedores y suministros"
            />
            <PgRow
              label="3. Gastos laborales"
              importe={stats.laborales}
              tone="gasto"
              hint="Nóminas y SS"
            />
            <article className="rounded-tpv-lg border-2 border-azul-colombia/30 bg-card p-5 shadow-tpv">
              <p className="font-sans text-xs font-semibold uppercase tracking-wide text-ink/50">
                4. Beneficio neto (EBITDA)
              </p>
              <p
                className={`mt-3 font-display text-4xl font-bold leading-none tracking-tight ${
                  stats.ebitda >= 0 ? "text-azul-colombia" : "text-rojo-colombia"
                }`}
              >
                {formatImporte(stats.ebitda)}
              </p>
              <p className="mt-2 text-xs text-ink/50">
                Ingresos − Operativos − Laborales
              </p>
            </article>
          </section>

          <section className="rounded-tpv-lg bg-card p-4 shadow-tpv">
            <h2 className="font-display text-lg text-ink">Caja cobrada</h2>
            <p className="mt-0.5 text-xs text-ink/50">
              Totales con IVA · método de pago
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <Banknote className="size-4 text-oro" aria-hidden />
                  Efectivo
                </span>
                <span className="font-display font-bold">
                  {formatImporte(stats.efectivo)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <CreditCard className="size-4 text-azul-asturias" aria-hidden />
                  Tarjeta
                </span>
                <span className="font-display font-bold">
                  {formatImporte(stats.tarjeta)}
                </span>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function PgRow({
  label,
  importe,
  tone,
  hint,
}: {
  label: string;
  importe: number;
  tone: "ingreso" | "gasto";
  hint?: string;
}) {
  return (
    <article className="rounded-tpv-lg bg-card p-4 shadow-tpv">
      <p className="font-sans text-xs font-semibold uppercase tracking-wide text-ink/50">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-3xl font-bold leading-none ${
          tone === "ingreso" ? "text-esmeralda" : "text-rojo-colombia"
        }`}
      >
        {formatImporte(importe)}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink/50">{hint}</p> : null}
    </article>
  );
}

function ModuleLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Truck;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-tpv bg-card text-center shadow-tpv transition active:scale-[0.98]"
    >
      <Icon className="size-5 text-azul-colombia" aria-hidden />
      <span className="text-[11px] font-semibold text-ink">{label}</span>
    </Link>
  );
}
