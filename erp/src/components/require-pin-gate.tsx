"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const KEY = "casa-torino-erp-unlocked";

/**
 * Obliga a pasar por /login (PIN) en cada nueva pestaña / recarga fuerte.
 * sessionStorage se limpia al cerrar la pestaña.
 */
export function RequirePinGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === "1") {
        setOk(true);
        return;
      }
    } catch {}
    router.replace("/login");
  }, [router]);

  if (!ok) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream px-6 text-sm font-semibold text-ink/55">
        Redirigiendo al PIN…
      </div>
    );
  }

  return <>{children}</>;
}
