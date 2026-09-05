/** Evento global para refrescar Dashboard/Historial tras mutaciones */
export const MOVIMIENTOS_CHANGED = "casa-torino:movimientos-changed";

export function notifyMovimientosChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MOVIMIENTOS_CHANGED));
}

export function onMovimientosChanged(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(MOVIMIENTOS_CHANGED, handler);
  return () => window.removeEventListener(MOVIMIENTOS_CHANGED, handler);
}
