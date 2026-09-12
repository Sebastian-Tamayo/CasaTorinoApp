/** Clave de mes: "YYYY-MM" (calendario local) */
export type MesKey = string;

export function mesActualKey(now = new Date()): MesKey {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function parseMesKey(mesKey: MesKey): { year: number; monthIndex: number } {
  const [y, m] = mesKey.split("-").map(Number);
  return { year: y!, monthIndex: m! - 1 };
}

/** Rango inclusivo del mes en ISO (zona local → UTC via toISOString) */
export function rangoMes(mesKey: MesKey): { inicioISO: string; finISO: string } {
  const { year, monthIndex } = parseMesKey(mesKey);
  const inicio = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const fin = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return {
    inicioISO: inicio.toISOString(),
    finISO: fin.toISOString(),
  };
}

/** "Septiembre 2026" (capitalizado, es-ES) */
export function labelMes(mesKey: MesKey): string {
  const { year, monthIndex } = parseMesKey(mesKey);
  const raw = new Date(year, monthIndex, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Meses disponibles para histórico (actual primero, hacia atrás) */
export function listarMesesHistorico(cantidad = 18, now = new Date()): MesKey[] {
  const keys: MesKey[] = [];
  for (let i = 0; i < cantidad; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(mesActualKey(d));
  }
  return keys;
}

export function esMesActual(mesKey: MesKey, now = new Date()): boolean {
  return mesKey === mesActualKey(now);
}
