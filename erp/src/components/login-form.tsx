"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Siempre pedir PIN al abrir (como TPV / cocina)
    void fetch("/api/erp-auth", {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => {});
  }, []);

  async function tryPin(nextPin: string) {
    if (nextPin.length < 4 || pending) return;
    setPending(true);
    setError(null);
    try {
      const r = await fetch("/api/erp-auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: nextPin }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        setPin("");
        setError(data.error || "PIN incorrecto");
        return;
      }
      router.push("/gestion");
      router.refresh();
    } catch {
      setError("No se pudo validar el PIN");
      setPin("");
    } finally {
      setPending(false);
    }
  }

  function onDigit(d: string) {
    if (pending) return;
    setError(null);
    if (d === "clear") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (d === "ok") {
      void tryPin(pin);
      return;
    }
    if (!/^\d$/.test(d) || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) setTimeout(() => void tryPin(next), 80);
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "ok"];

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-sm font-semibold text-ink/60">PIN del personal</p>
      <div className="flex gap-3" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`size-3 rounded-full border-2 ${
              i < pin.length
                ? "border-oro bg-oro"
                : "border-ink/25 bg-transparent"
            }`}
          />
        ))}
      </div>

      <div className="grid w-full grid-cols-3 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            disabled={pending}
            onClick={() => onDigit(k)}
            className="min-h-14 rounded-tpv border border-ink/10 bg-card text-xl font-extrabold text-ink shadow-tpv transition active:scale-[0.97] disabled:opacity-60"
          >
            {k === "clear" ? "Borrar" : k === "ok" ? "Entrar" : k}
          </button>
        ))}
      </div>

      {error ? (
        <p
          role="alert"
          className="w-full rounded-tpv bg-rojo-colombia/10 px-3 py-2 text-center text-sm text-rojo-colombia"
        >
          {error}
        </p>
      ) : null}

      <p className="text-center text-xs text-ink/45">
        Mismo acceso que TPV / cocina · oficina del negocio
      </p>
    </div>
  );
}
