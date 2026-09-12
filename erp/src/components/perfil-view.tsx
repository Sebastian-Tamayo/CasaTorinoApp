"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function inicialesFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }

  return local.slice(0, 2).toUpperCase() || "?";
}

function PerfilSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <p className="text-sm font-medium text-ink/50">Cargando…</p>
      <div className="animate-pulse rounded-tpv-lg bg-card p-5 shadow-tpv">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-full bg-ink/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-ink/10" />
            <div className="h-3 w-32 rounded bg-ink/10" />
          </div>
        </div>
      </div>
      <div className="h-14 animate-pulse rounded-tpv bg-ink/10" />
    </div>
  );
}

export function PerfilView() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError) {
        setError(userError.message);
        setEmail(null);
      } else {
        setEmail(user?.email ?? null);
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const iniciales = useMemo(
    () => (email ? inicialesFromEmail(email) : "?"),
    [email],
  );

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError(signOutError.message);
        setSigningOut(false);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar sesión");
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="font-display text-2xl text-ink">Perfil</h1>
          <p className="mt-1 font-sans text-sm text-ink/55">
            Sesión activa para auditoría
          </p>
        </header>
        <PerfilSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl text-ink">Perfil</h1>
        <p className="mt-1 font-sans text-sm text-ink/55">
          Sesión activa para auditoría
        </p>
      </header>

      <article className="rounded-tpv-lg bg-card p-5 shadow-tpv">
        <div className="flex items-center gap-4">
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-azul-colombia font-display text-xl font-bold text-white"
            aria-hidden
          >
            {iniciales}
          </div>
          <div className="min-w-0">
            <p className="truncate font-sans text-base font-semibold text-ink">
              {email ?? "Sin email"}
            </p>
            <p className="mt-1 font-sans text-sm text-ink/55">
              Socia / Administradora
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
        {signingOut ? "Cerrando sesión…" : "Cerrar Sesión"}
      </button>
    </div>
  );
}
