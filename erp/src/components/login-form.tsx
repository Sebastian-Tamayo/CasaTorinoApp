"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      router.push("/gestion");
      router.refresh();
    } catch (err) {
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
