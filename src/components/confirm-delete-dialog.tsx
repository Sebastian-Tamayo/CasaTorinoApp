"use client";

type ConfirmDeleteDialogProps = {
  open: boolean;
  tipo: "gasto" | "ingreso" | "documento";
  importeLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({
  open,
  tipo,
  importeLabel,
  pending = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  if (!open) return null;

  const titulo =
    tipo === "documento" ? "Eliminar documento" : `Eliminar ${tipo}`;
  const descripcion =
    tipo === "documento" ? (
      <>
        ¿Estás segura de eliminar el documento{" "}
        <span className="font-semibold text-ink">{importeLabel}</span>? Se
        borrará también del archivo en Storage.
      </>
    ) : (
      <>
        ¿Estás segura de eliminar este {tipo} de{" "}
        <span className="font-semibold text-ink">{importeLabel}</span>? Esta
        acción no se puede deshacer.
      </>
    );

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 p-4 sm:items-center"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-desc"
        className="w-full max-w-sm rounded-tpv-lg bg-card p-5 shadow-tpv-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-delete-title"
          className="font-display text-xl text-ink"
        >
          {titulo}
        </h2>
        <p id="confirm-delete-desc" className="mt-2 text-sm text-ink/65">
          {descripcion}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="min-h-touch rounded-tpv border border-ink/15 bg-cream text-sm font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="min-h-touch rounded-tpv bg-rojo-colombia text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
