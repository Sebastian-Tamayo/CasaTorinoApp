import { GastoForm } from "@/components/gasto-form";

export default function NuevoGastoPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl text-ink">Nuevo gasto</h1>
        <p className="mt-1 text-sm text-ink/55">
          Elige el origen de fondos antes de guardar — evita descuadres de caja.
        </p>
      </div>
      <GastoForm />
    </div>
  );
}
