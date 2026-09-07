"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, UserPlus, Users } from "lucide-react";
import {
  deleteEmpleado,
  liquidarMes,
  upsertEmpleado,
  type EmpleadoFormState,
  type LiquidarState,
} from "@/app/actions/rrhh";
import { showToast } from "@/components/toast";
import { createClient } from "@/lib/supabase/client";
import { notifyMovimientosChanged } from "@/lib/movimientos-events";
import { labelMes, mesActualKey } from "@/lib/meses";
import type { Empleado } from "@/types/database";

const initialForm: EmpleadoFormState = {};

function formatImporte(n: number) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export function RrhhView() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Empleado | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formState, formAction, formPending] = useActionState(
    upsertEmpleado,
    initialForm,
  );
  const [liquidando, setLiquidando] = useState(false);

  async function reload() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("empleados")
      .select("*")
      .eq("activo", true)
      .order("nombre");

    if (error) {
      showToast(error.message, "error");
      setEmpleados([]);
    } else {
      setEmpleados((data as Empleado[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (formState.success) {
      showToast(editing ? "Empleado actualizado" : "Empleado dado de alta");
      setShowForm(false);
      setEditing(null);
      void reload();
    }
  }, [formState.success, editing]);

  async function handleLiquidar() {
    setLiquidando(true);
    const result: LiquidarState = await liquidarMes();
    setLiquidando(false);

    if (result.error) {
      showToast(result.error, "error");
      return;
    }

    showToast(result.message ?? "Nóminas liquidadas");
    notifyMovimientosChanged();
  }

  async function handleBaja(id: string) {
    if (!window.confirm("¿Dar de baja a este empleado?")) return;
    const res = await deleteEmpleado(id);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    showToast("Empleado dado de baja");
    void reload();
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl text-ink">RRHH</h1>
        <p className="mt-1 text-sm text-ink/55">
          Empleados y liquidación · {labelMes(mesActualKey())}
        </p>
      </header>

      <button
        type="button"
        onClick={() => void handleLiquidar()}
        disabled={liquidando || empleados.length === 0}
        className="min-h-14 rounded-tpv bg-azul-colombia text-base font-bold text-white shadow-tpv transition active:scale-[0.98] disabled:opacity-50"
      >
        {liquidando ? "Liquidando…" : "Liquidar mes"}
      </button>

      <button
        type="button"
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
        className="flex min-h-touch items-center justify-center gap-2 rounded-tpv border border-ink/15 bg-card text-sm font-semibold text-ink shadow-tpv"
      >
        <UserPlus className="size-4" aria-hidden />
        Alta empleado
      </button>

      {showForm ? (
        <form
          action={formAction}
          className="flex flex-col gap-3 rounded-tpv-lg bg-card p-4 shadow-tpv"
        >
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <h2 className="font-display text-lg text-ink">
            {editing ? "Editar empleado" : "Nuevo empleado"}
          </h2>
          <input
            name="nombre"
            required
            defaultValue={editing?.nombre ?? ""}
            placeholder="Nombre"
            className="min-h-touch rounded-tpv border border-ink/10 px-3 text-sm"
          />
          <input
            name="puesto"
            required
            defaultValue={editing?.puesto ?? ""}
            placeholder="Puesto"
            className="min-h-touch rounded-tpv border border-ink/10 px-3 text-sm"
          />
          <input
            name="salario_bruto"
            required
            inputMode="decimal"
            defaultValue={editing?.salario_bruto ?? ""}
            placeholder="Salario bruto €"
            className="min-h-touch rounded-tpv border border-ink/10 px-3 text-sm"
          />
          <input
            name="coste_seguridad_social"
            inputMode="decimal"
            defaultValue={editing?.coste_seguridad_social ?? "0"}
            placeholder="Coste SS empresa €"
            className="min-h-touch rounded-tpv border border-ink/10 px-3 text-sm"
          />
          <input
            name="porcentaje_retencion_irpf"
            inputMode="decimal"
            defaultValue={editing?.porcentaje_retencion_irpf ?? "0"}
            placeholder="% retención IRPF"
            className="min-h-touch rounded-tpv border border-ink/10 px-3 text-sm"
          />
          {formState.error ? (
            <p className="text-sm text-rojo-colombia">{formState.error}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="min-h-touch rounded-tpv border border-ink/15 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={formPending}
              className="min-h-touch rounded-tpv bg-esmeralda text-sm font-bold text-white disabled:opacity-50"
            >
              {formPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink/50">Cargando…</p>
      ) : empleados.length === 0 ? (
        <div className="rounded-tpv-lg bg-card px-6 py-10 text-center shadow-tpv">
          <Users className="mx-auto size-8 text-ink/30" aria-hidden />
          <p className="mt-3 font-display text-lg text-ink">Sin plantilla</p>
          <p className="mt-1 text-sm text-ink/55">
            Da de alta al equipo para poder liquidar nóminas.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {empleados.map((e) => (
            <li key={e.id} className="rounded-tpv-lg bg-card p-4 shadow-tpv">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{e.nombre}</p>
                  <p className="text-xs text-ink/50">{e.puesto}</p>
                </div>
                <button
                  type="button"
                  aria-label="Editar"
                  onClick={() => {
                    setEditing(e);
                    setShowForm(true);
                  }}
                  className="flex size-9 items-center justify-center rounded-tpv border border-ink/10 text-ink/60"
                >
                  <Pencil className="size-4" />
                </button>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <dt className="text-ink/45">Bruto</dt>
                  <dd className="font-display text-sm font-bold text-ink">
                    {formatImporte(Number(e.salario_bruto))}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink/45">SS emp.</dt>
                  <dd className="font-display text-sm font-bold text-ink">
                    {formatImporte(Number(e.coste_seguridad_social))}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink/45">IRPF</dt>
                  <dd className="font-display text-sm font-bold text-ink">
                    {Number(e.porcentaje_retencion_irpf)}%
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => void handleBaja(e.id)}
                className="mt-3 w-full text-xs font-semibold text-rojo-colombia"
              >
                Dar de baja
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
