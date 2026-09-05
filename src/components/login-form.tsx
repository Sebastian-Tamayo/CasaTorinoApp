"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * DEBUG TEMPORAL — login en cliente con console.log del error Supabase
 * y de las variables NEXT_PUBLIC_* leídas por la app.
 * Quitar cuando se confirme la causa del rechazo.
 */
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log("[Casa Torino DEBUG] NEXT_PUBLIC_SUPABASE_URL =", url);
    console.log("[Casa Torino DEBUG] NEXT_PUBLIC_SUPABASE_ANON_KEY =", anonKey);
    console.log("[Casa Torino DEBUG] URL definida:", Boolean(url));
    console.log(
      "[Casa Torino DEBUG] Anon key definida:",
      Boolean(anonKey),
      "| longitud:",
      anonKey?.length ?? 0,
    );
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log("[Casa Torino DEBUG] Intento de login con email:", email);
    console.log("[Casa Torino DEBUG] URL usada en este intento:", url);
    console.log("[Casa Torino DEBUG] Anon Key usada en este intento:", anonKey);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Error exacto de Supabase (message, status, code, name, …)
        console.error("[Casa Torino DEBUG] Error Supabase Auth:", authError);
        console.error("[Casa Torino DEBUG] error.message =", authError.message);
        console.error("[Casa Torino DEBUG] error.status =", authError.status);
        console.error("[Casa Torino DEBUG] error.code =", authError.code);
        console.error(
          "[Casa Torino DEBUG] error (JSON) =",
          JSON.stringify(authError, null, 2),
        );
        setError(authError.message);
        return;
      }

      console.log("[Casa Torino DEBUG] Login OK. user.id =", data.user?.id);
      router.push("/gestion");
      router.refresh();
    } catch (err) {
      console.error("[Casa Torino DEBUG] Excepción inesperada:", err);
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink/70">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          inputMode="email"
          className="min-h-touch rounded-tpv border border-ink/10 bg-card px-4 text-base text-ink outline-none ring-azul-colombia/30 focus:ring-2"
          placeholder="tu@email.com"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink/70">Contraseña</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-touch rounded-tpv border border-ink/10 bg-card px-4 text-base text-ink outline-none ring-azul-colombia/30 focus:ring-2"
          placeholder="••••••••"
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-tpv bg-rojo-colombia/10 px-3 py-2 text-sm text-rojo-colombia"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-touch mt-2 rounded-tpv bg-azul-colombia text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
