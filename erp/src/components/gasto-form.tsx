"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createGasto, type GastoFormState } from "@/app/actions/gastos";
import { archiveDocumento } from "@/lib/documentos";
import { totalConIva } from "@/lib/fiscal";
import {
  CATEGORIAS,
  IVA_OPCIONES,
  type OrigenFondos,
} from "@/types/database";

const initial: GastoFormState = {};

export function GastoForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createGasto, initial);
  const [origen, setOrigen] = useState<OrigenFondos | "">("");
  const [categoria, setCategoria] = useState("");
  const [base, setBase] = useState("");
  const [iva, setIva] = useState(0);
  const [proveedor, setProveedor] = useState("");
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const baseNum = Number.parseFloat(base.replace(",", ".")) || 0;
  const total = useMemo(() => totalConIva(baseNum, iva), [baseNum, iva]);

  useEffect(() => {
    if (!state.success || !state.gastoId) return;

    let cancelled = false;

    async function afterSave() {
      if (adjunto) {
        setUploadingDoc(true);
        const res = await archiveDocumento({
          file: adjunto,
          nombre: adjunto.name,
          categoria: "factura_proveedor",
          proveedor_nombre: state.proveedor_nombre ?? proveedor,
          gasto_id: state.gastoId,
        });
        if (cancelled) return;
        setUploadingDoc(false);
        if (res.error) {
          setUploadError(
            `Gasto guardado, pero el adjunto falló: ${res.error}`,
          );
          return;
        }
      }
      if (cancelled) return;
      router.push("/gestion/historial");
      router.refresh();
    }

    void afterSave();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al éxito del gasto
  }, [state.success, state.gastoId]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/60">
          Origen de los fondos
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <OrigenButton
            value="Efectivo_Caja"
            label="Efectivo Caja"
            hint="Caja física"
            selected={origen === "Efectivo_Caja"}
            onSelect={setOrigen}
            tone="caja"
          />
          <OrigenButton
            value="Banco"
            label="Banco"
            hint="Transferencia / tarjeta"
            selected={origen === "Banco"}
            onSelect={setOrigen}
            tone="banco"
          />
        </div>
        <input type="hidden" name="origen_fondos" value={origen} required />
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold uppercase tracking-wide text-ink/60">
          Base imponible (€)
        </span>
        <input
          name="base_imponible"
          type="text"
          inputMode="decimal"
          required
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="0,00"
          className="min-h-14 rounded-tpv border border-ink/10 bg-card px-4 font-display text-3xl text-ink outline-none ring-azul-colombia/30 focus:ring-2"
        />
      </label>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/60">
          IVA %
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {IVA_OPCIONES.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => setIva(pct)}
              className={`min-h-touch rounded-tpv border text-sm font-bold transition active:scale-[0.98] ${
                iva === pct
                  ? "border-azul-colombia bg-azul-colombia text-white"
                  : "border-ink/10 bg-card text-ink"
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
        <input type="hidden" name="porcentaje_iva" value={iva} />
        <p className="mt-2 text-sm text-ink/55">
          Total con IVA:{" "}
          <span className="font-display font-bold text-ink">
            {total.toLocaleString("es-ES", {
              style: "currency",
              currency: "EUR",
            })}
          </span>
        </p>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold uppercase tracking-wide text-ink/60">
          Proveedor (opcional)
        </span>
        <input
          name="proveedor_nombre"
          type="text"
          maxLength={120}
          value={proveedor}
          onChange={(e) => setProveedor(e.target.value)}
          placeholder="Ej. Makro, Coca-Cola…"
          className="min-h-touch rounded-tpv border border-ink/10 bg-card px-4 text-base text-ink outline-none ring-azul-colombia/30 focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold uppercase tracking-wide text-ink/60">
          Concepto
        </span>
        <input
          name="concepto"
          type="text"
          required
          maxLength={200}
          placeholder="Ej. Compra verdura mercado"
          className="min-h-touch rounded-tpv border border-ink/10 bg-card px-4 text-base text-ink outline-none ring-azul-colombia/30 focus:ring-2"
        />
      </label>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/60">
          Categoría
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIAS.filter((c) => c !== "Nóminas y SS").map((cat) => {
            const selected = categoria === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoria(cat)}
                className={`min-h-touch rounded-tpv border px-3 text-sm font-medium transition active:scale-[0.98] ${
                  selected
                    ? "border-esmeralda bg-esmeralda text-white"
                    : "border-ink/10 bg-card text-ink"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="categoria" value={categoria} required />
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold uppercase tracking-wide text-ink/60">
          Adjuntar documento (opcional)
        </span>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => setAdjunto(e.target.files?.[0] ?? null)}
          className="min-h-touch rounded-tpv border border-dashed border-ink/20 bg-card px-3 py-2 text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-azul-colombia/10 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-azul-colombia"
        />
        <span className="text-xs text-ink/45">
          PDF / JPG / PNG · máx. 10 MB · se archiva como factura de proveedor
        </span>
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-tpv bg-rojo-colombia/10 px-3 py-2 text-sm text-rojo-colombia"
        >
          {state.error}
        </p>
      ) : null}

      {uploadError ? (
        <p role="alert" className="rounded-tpv bg-oro/20 px-3 py-2 text-sm text-ink">
          {uploadError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={
          pending || uploadingDoc || !origen || !categoria || baseNum <= 0
        }
        className="min-h-14 rounded-tpv bg-amarillo-colombia text-lg font-bold text-ink shadow-tpv transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending || uploadingDoc
          ? uploadingDoc
            ? "Archivando adjunto…"
            : "Guardando…"
          : "Registrar gasto"}
      </button>
    </form>
  );
}

function OrigenButton({
  value,
  label,
  hint,
  selected,
  onSelect,
  tone,
}: {
  value: OrigenFondos;
  label: string;
  hint: string;
  selected: boolean;
  onSelect: (v: OrigenFondos) => void;
  tone: "caja" | "banco";
}) {
  const active =
    tone === "caja"
      ? "border-oro bg-oro/20 text-ink ring-2 ring-oro"
      : "border-azul-asturias bg-azul-asturias/15 text-ink ring-2 ring-azul-asturias";

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-tpv-lg border px-3 text-center transition active:scale-[0.98] ${
        selected ? active : "border-ink/10 bg-card text-ink"
      }`}
    >
      <span className="text-base font-bold leading-tight">{label}</span>
      <span className="text-xs text-ink/50">{hint}</span>
    </button>
  );
}
