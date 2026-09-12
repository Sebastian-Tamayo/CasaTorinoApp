"use client";

import { useEffect, useState } from "react";

type ToastState = {
  message: string;
  tone: "success" | "error";
} | null;

let showToastFn: ((message: string, tone?: "success" | "error") => void) | null =
  null;

export function showToast(
  message: string,
  tone: "success" | "error" = "success",
) {
  showToastFn?.(message, tone);
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    showToastFn = (message, tone = "success") => {
      setToast({ message, tone });
    };
    return () => {
      showToastFn = null;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-4 bottom-[calc(var(--spacing-nav)+1rem)] z-[60] mx-auto max-w-lg rounded-tpv px-4 py-3 text-center text-sm font-semibold shadow-tpv-lg ${
        toast.tone === "success"
          ? "bg-esmeralda text-white"
          : "bg-rojo-colombia text-white"
      }`}
    >
      {toast.message}
    </div>
  );
}
