"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function PerfilView() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await fetch("/api/erp-auth", {
        method: "DELETE",
        credentials: "same-origin",
      });
      try {
        sessionStorage.removeItem("casa-torino-erp-unlocked");
      } catch {}
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar sesión");
      setSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl text-ink">Perfil</h1>
        <p className="mt-1 font-sans text-sm text-ink/55">
          Acceso por PIN · oficina Casa Torino
        </p>
      </header>

      <article className="rounded-tpv-lg bg-card p-5 shadow-tpv">
        <div className="flex items-center gap-4">
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-oro bg-oro/20 font-display text-xl font-bold text-ink"
            aria-hidden
          >
            CT
          </div>
          <div className="min-w-0">
            <p className="truncate font-sans text-base font-semibold text-ink">
              Personal autorizado
            </p>
            <p className="mt-1 font-sans text-sm text-ink/55">
              Dueñas / administración
            </p>
          </div>
        </div>
      </article>

      {error ? (
        <p
          role="alert"
          className="rounded-tpv bg-rojo-colombia/10 px-4 py-3 text-sm text-rojo-colombia"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={signingOut}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-tpv bg-rojo-colombia text-lg font-bold text-white shadow-tpv transition active:scale-[0.98] disabled:opacity-60"
      >
        <LogOut className="size-5" aria-hidden />
        {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
    </div>
  );
}
