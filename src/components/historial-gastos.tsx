"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  CreditCard,
  Receipt,
  Trash2,
} from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { MonthSelector } from "@/components/month-selector";
import { showToast } from "@/components/toast";
import { createClient } from "@/lib/supabase/client";
import { notifyMovimientosChanged } from "@/lib/movimientos-events";
import {
  labelMes,
  mesActualKey,
  rangoMes,
  type MesKey,
} from "@/lib/meses";
import type { Gasto, Ingreso } from "@/types/database";
import { CATEGORIAS_INGRESO } from "@/types/database";

type Movimiento =
  | ({ tipo: "gasto" } & Gasto)
  | ({ tipo: "ingreso" } & Ingreso);

type PendingDelete = {
  tipo: "gasto" | "ingreso";
  id: string;
  importe: number;
} | null;

function formatFecha(iso: string) {
  const d = new Date(iso);
  const diaMes = d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
  const hora = d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${diaMes} · ${hora}`;
}

function formatImporte(importe: number) {
  return Number(importe).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

function labelCategoriaIngreso(categoria: Ingreso["categoria"]) {
  return (
    CATEGORIAS_INGRESO.find((c) => c.value === categoria)?.label ?? categoria
  );
}

function HistorialSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      <p className="text-sm font-medium text-ink/50">Cargando…</p>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-tpv-lg bg-card p-4 shadow-tpv"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="h-8 w-28 rounded bg-ink/10" />
            <div className="h-5 w-20 rounded bg-ink/10" />
          </div>
          <div className="mt-3 h-4 w-3/4 rounded bg-ink/10" />
          <div className="mt-3 flex gap-2">
            <div className="h-6 w-24 rounded-full bg-ink/10" />
            <div className="h-6 w-20 rounded-full bg-ink/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Eliminar"
      className="flex size-10 shrink-0 items-center justify-center rounded-tpv border border-rojo-colombia/25 bg-rojo-colombia/10 text-rojo-colombia transition active:scale-[0.96]"
    >
      <Trash2 className="size-5" aria-hidden />
    </button>
  );
}

function GastoCard({
  gasto,
  onDelete,
}: {
  gasto: Gasto;
  onDelete: () => void;
}) {
  const esCaja = gasto.origen_fondos === "Efectivo_Caja";

  return (
    <article className="rounded-tpv-lg border-l-4 border-rojo-colombia bg-card p-4 shadow-tpv">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-rojo-colombia">
            <ArrowUpRight className="size-3.5" aria-hidden />
            Gasto
          </span>
          <p className="mt-1 font-display text-2xl font-bold leading-none text-rojo-colombia">
            −{formatImporte(gasto.importe)}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <time
            dateTime={gasto.created_at}
            className="text-xs font-medium capitalize text-ink/50"
          >
            {formatFecha(gasto.created_at)}
          </time>
          <DeleteButton onClick={onDelete} />
        </div>
      </div>

      <p className="mt-2 truncate font-sans text-sm font-medium text-ink/80">
        {gasto.concepto}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-rojo-colombia/10 px-2.5 py-1 text-xs font-semibold text-rojo-colombia">
          {gasto.categoria}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            esCaja
              ? "bg-oro/20 text-ink"
              : "bg-azul-asturias/15 text-azul-asturias"
          }`}
        >
          {esCaja ? (
            <Banknote className="size-3.5" aria-hidden />
          ) : (
            <Building2 className="size-3.5" aria-hidden />
          )}
          {esCaja ? "Efectivo" : "Banco"}
        </span>
      </div>
    </article>
  );
}

function IngresoCard({
  ingreso,
  onDelete,
}: {
  ingreso: Ingreso;
  onDelete: () => void;
}) {
  const esEfectivo = ingreso.metodo_pago === "efectivo";

  return (
    <article className="rounded-tpv-lg border-l-4 border-esmeralda bg-card p-4 shadow-tpv">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-esmeralda">
            <ArrowDownLeft className="size-3.5" aria-hidden />
            Ingreso
          </span>
          <p className="mt-1 font-display text-2xl font-bold leading-none text-esmeralda">
            +{formatImporte(ingreso.importe)}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <time
            dateTime={ingreso.created_at}
            className="text-xs font-medium capitalize text-ink/50"
          >
            {formatFecha(ingreso.created_at)}
          </time>
          <DeleteButton onClick={onDelete} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-esmeralda/10 px-2.5 py-1 text-xs font-semibold text-esmeralda">
          {labelCategoriaIngreso(ingreso.categoria)}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            esEfectivo
              ? "bg-oro/20 text-ink"
              : "bg-azul-asturias/15 text-azul-asturias"
          }`}
        >
          {esEfectivo ? (
            <Banknote className="size-3.5" aria-hidden />
          ) : (
            <CreditCard className="size-3.5" aria-hidden />
          )}
          {esEfectivo ? "Efectivo" : "Tarjeta"}
        </span>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-tpv-lg bg-card px-6 py-12 text-center shadow-tpv">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-cream">
        <Receipt className="size-7 text-ink/35" aria-hidden />
      </div>
      <p className="font-display text-xl text-ink">Sin movimientos aún</p>
      <p className="mt-2 max-w-xs text-sm text-ink/55">
        Registra ingresos y gastos para ver aquí el control de caja unificado.
      </p>
      <Link
        href="/gestion/nuevo"
        className="mt-6 inline-flex min-h-touch items-center justify-center rounded-tpv bg-amarillo-colombia px-6 text-sm font-bold text-ink shadow-tpv transition active:scale-[0.98]"
      >
        Registrar movimiento
      </Link>
    </div>
  );
}

export function HistorialGastos() {
  const [mesKey, setMesKey] = useState<MesKey>(() => mesActualKey());
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [deleting, setDeleting] = useState(false);

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
          .select("*")
          .gte("created_at", inicioISO)
          .lte("created_at", finISO)
          .order("created_at", { ascending: false }),
        supabase
          .from("ingresos")
          .select("*")
          .gte("created_at", inicioISO)
          .lte("created_at", finISO)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      if (gastosRes.error || ingresosRes.error) {
        setError(
          gastosRes.error?.message ??
            ingresosRes.error?.message ??
            "Error al cargar historial",
        );
        setMovimientos([]);
      } else {
        const gastos: Movimiento[] = (gastosRes.data ?? []).map((g) => ({
          tipo: "gasto" as const,
          ...(g as Gasto),
        }));
        const ingresos: Movimiento[] = (ingresosRes.data ?? []).map((i) => ({
          tipo: "ingreso" as const,
          ...(i as Ingreso),
        }));

        const merged = [...gastos, ...ingresos].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setMovimientos(merged);
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [mesKey]);

  const titulo = useMemo(() => {
    const mes = labelMes(mesKey);
    if (movimientos.length === 0) return `Sin movimientos en ${mes}`;
    return `${movimientos.length} movimientos · ${mes}`;
  }, [movimientos.length, mesKey]);

  async function confirmDelete() {
    if (!pendingDelete) return;

    setDeleting(true);
    const { tipo, id } = pendingDelete;
    const tabla = tipo === "gasto" ? "gastos" : "ingresos";

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from(tabla)
      .delete()
      .eq("id", id);

    setDeleting(false);

    if (deleteError) {
      showToast(`No se pudo eliminar: ${deleteError.message}`, "error");
      return;
    }

    setMovimientos((prev) =>
      prev.filter((m) => !(m.tipo === tipo && m.id === id)),
    );
    setPendingDelete(null);
    notifyMovimientosChanged();
    showToast(
      tipo === "gasto" ? "Gasto eliminado correctamente" : "Ingreso eliminado correctamente",
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl text-ink">Historial</h1>
        <p className="mt-1 font-sans text-sm text-ink/55">{titulo}</p>
      </header>

      <MonthSelector value={mesKey} onChange={setMesKey} id="historial-mes" />

      {loading ? <HistorialSkeleton /> : null}

      {!loading && error ? (
        <p
          role="alert"
          className="rounded-tpv bg-rojo-colombia/10 px-4 py-3 text-sm text-rojo-colombia"
        >
          No se pudo cargar el historial: {error}
        </p>
      ) : null}

      {!loading && !error && movimientos.length === 0 ? <EmptyState /> : null}

      {!loading && !error && movimientos.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {movimientos.map((m) => (
            <li key={`${m.tipo}-${m.id}`}>
              {m.tipo === "gasto" ? (
                <GastoCard
                  gasto={m}
                  onDelete={() =>
                    setPendingDelete({
                      tipo: "gasto",
                      id: m.id,
                      importe: Number(m.importe),
                    })
                  }
                />
              ) : (
                <IngresoCard
                  ingreso={m}
                  onDelete={() =>
                    setPendingDelete({
                      tipo: "ingreso",
                      id: m.id,
                      importe: Number(m.importe),
                    })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <ConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        tipo={pendingDelete?.tipo ?? "gasto"}
        importeLabel={
          pendingDelete ? formatImporte(pendingDelete.importe) : ""
        }
        pending={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
