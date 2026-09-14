"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Calculator,
  Receipt,
  Truck,
  Utensils,
  Wine,
} from "lucide-react";
import { MonthSelector } from "@/components/month-selector";
import { createClient } from "@/lib/supabase/client";
import { onMovimientosChanged } from "@/lib/movimientos-events";
import { fetchCierres, type CierreItem } from "@/lib/cierres";
import {
  esMesActual,
  labelMes,
  mesActualKey,
  rangoMes,
  type MesKey,
} from "@/lib/meses";
import type { Gasto } from "@/types/database";

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

export function DashboardInicio() {
  const [mesKey, setMesKey] = useState<MesKey>(() => mesActualKey());
  const [refreshTick, setRefreshTick] = useState(0);
  const [gastosMes, setGastosMes] = useState<
    Pick<Gasto, "importe" | "categoria" | "created_at" | "base_imponible">[]
  >([]);
  const [cierres, setCierres] = useState<CierreItem[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [monthTickets, setMonthTickets] = useState(0);
  const [comidaTotal, setComidaTotal] = useState(0);
  const [bebidaTotal, setBebidaTotal] = useState(0);
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

      const [gastosRes, cierresRes] = await Promise.all([
        supabase
          .from("gastos")
          .select("importe, categoria, created_at, base_imponible")
          .gte("created_at", inicioISO)
          .lte("created_at", finISO)
          .order("created_at", { ascending: false }),
        fetchCierres(mesKey).catch((err: Error) => ({ error: err })),
      ]);

      if (cancelled) return;

      if (gastosRes.error) {
        // Gastos pueden fallar sin sesión Supabase; no bloqueamos la recaudación TPV
        setGastosMes([]);
      } else {
        setGastosMes(gastosRes.data ?? []);
      }

      if ("error" in cierresRes) {
        setError(cierresRes.error.message);
        setCierres([]);
        setMonthTotal(0);
        setMonthTickets(0);
        setComidaTotal(0);
        setBebidaTotal(0);
      } else {
        setCierres(cierresRes.items || []);
        setMonthTotal(cierresRes.monthTotals?.total || 0);
        setMonthTickets(cierresRes.monthTotals?.tickets || 0);
        setComidaTotal(cierresRes.monthTotals?.byType?.comida?.total || 0);
        setBebidaTotal(cierresRes.monthTotals?.byType?.bebida?.total || 0);
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [mesKey, refreshTick]);

  const stats = useMemo(() => {
    let operativos = 0;
    let laborales = 0;
    for (const g of gastosMes) {
      const base = Number(g.base_imponible ?? g.importe);
      if (g.categoria === "Nóminas y SS") laborales += base;
      else operativos += base;
    }
    // Ingresos oficiales = cierres TPV (IVA incl. → base ≈ /1.1)
    const ingresosBase = Math.round((monthTotal / 1.1) * 100) / 100;
    const ebitda = ingresosBase - operativos - laborales;
    const hoyKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const hoyTotal = mesEsActual
      ? cierres
          .filter((c) => c.dayKey === hoyKey)
          .reduce((a, c) => a + (Number(c.totals?.total) || 0), 0)
      : 0;

    return { ingresosBase, operativos, laborales, ebitda, hoyTotal };
  }, [gastosMes, monthTotal, cierres, mesEsActual]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-oro">
          Oficina · recaudación real
        </p>
        <h1 className="mt-1 font-display text-2xl text-ink">Inicio</h1>
        <p className="mt-1 font-sans text-sm text-ink/55">
          Cierres del TPV · {mesLabel}
        </p>
      </header>

      <MonthSelector value={mesKey} onChange={setMesKey} id="dashboard-mes" />

      <nav aria-label="Módulos ERP" className="grid grid-cols-4 gap-2">
        <ModuleLink href="/gestion/caja" label="Caja TPV" icon={Receipt} />
        <ModuleLink href="/gestion/rrhh" label="RRHH" icon={Briefcase} />
        <ModuleLink href="/gestion/proveedores" label="Proveed." icon={Truck} />
        <ModuleLink href="/gestion/fiscal" label="Fiscal" icon={Calculator} />
      </nav>

      {loading ? (
        <p className="text-sm text-ink/50">Cargando…</p>
      ) : error ? (
        <p
          role="alert"
          className="rounded-tpv bg-rojo-colombia/10 px-4 py-3 text-sm text-rojo-colombia"
        >
          {error}
        </p>
      ) : (
        <>
          <article className="rounded-tpv-lg border-2 border-oro/40 bg-card p-5 shadow-tpv-lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
              Recaudado en el mes (cierres TPV)
            </p>
            <p className="mt-3 font-display text-4xl font-bold text-ink">
              {formatImporte(monthTotal)}
            </p>
            <p className="mt-2 text-xs text-ink/50">
              {monthTickets} ticket{monthTickets === 1 ? "" : "s"} ·{" "}
              {cierres.length} cierre{cierres.length === 1 ? "" : "s"}
              {mesEsActual
                ? ` · Hoy: ${formatImporte(stats.hoyTotal)}`
                : ""}
            </p>
            <p className="mt-3 rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-ink/65">
              Los ingresos ya no se apuntan a mano: salen del{" "}
              <span className="text-oro">Fin de sesión</span> del TPV.
            </p>
          </article>

          <section className="grid grid-cols-2 gap-3">
            <article className="rounded-tpv-lg bg-card p-4 shadow-tpv">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink/50">
                <Utensils className="size-3.5 text-oro" aria-hidden />
                Comida
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-ink">
                {formatImporte(comidaTotal)}
              </p>
            </article>
            <article className="rounded-tpv-lg bg-card p-4 shadow-tpv">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink/50">
                <Wine className="size-3.5 text-oro" aria-hidden />
                Bebida
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-ink">
                {formatImporte(bebidaTotal)}
              </p>
            </article>
          </section>

          <section className="flex flex-col gap-3" aria-label="Pérdidas y ganancias">
            <PgRow
              label="1. Ingresos TPV (base ≈ IVA 10%)"
              importe={stats.ingresosBase}
              tone="ingreso"
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
            <article className="rounded-tpv-lg border-2 border-ink/10 bg-card p-5 shadow-tpv">
              <p className="font-sans text-xs font-semibold uppercase tracking-wide text-ink/50">
                4. Beneficio neto (EBITDA)
              </p>
              <p
                className={`mt-3 font-display text-4xl font-bold leading-none tracking-tight ${
                  stats.ebitda >= 0 ? "text-esmeralda" : "text-rojo-colombia"
                }`}
              >
                {formatImporte(stats.ebitda)}
              </p>
            </article>
          </section>

          <section className="rounded-tpv-lg bg-card p-4 shadow-tpv">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg text-ink">Últimos cierres</h2>
              <Link
                href="/gestion/caja"
                className="text-xs font-bold text-oro underline-offset-2 hover:underline"
              >
                Ver historial
              </Link>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {cierres.length === 0 ? (
                <li className="text-sm text-ink/50">
                  Aún no hay cierres este mes. Al pulsar «Fin de sesión» en el
                  TPV aparecerán aquí.
                </li>
              ) : (
                cierres.slice(0, 6).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ink/5 bg-cream/80 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">
                        {c.dayKey} · {fmtHm(c.startedAt)}–{fmtHm(c.endedAt)}
                      </p>
                      <p className="text-xs text-ink/50">
                        {c.totals?.tickets || 0} tickets
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-lg font-bold text-ink">
                      {formatImporte(c.totals?.total || 0)}
                    </p>
                  </li>
                ))
              )}
            </ul>
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
      <Icon className="size-5 text-oro" aria-hidden />
      <span className="text-[11px] font-semibold text-ink">{label}</span>
    </Link>
  );
}
