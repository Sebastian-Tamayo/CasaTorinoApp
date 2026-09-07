/** Cuota IVA = base * (porcentaje / 100) */
export function cuotaIva(base: number, porcentaje: number) {
  return round2((base * porcentaje) / 100);
}

/** Total con IVA = base + cuota */
export function totalConIva(base: number, porcentaje: number) {
  return round2(base + cuotaIva(base, porcentaje));
}

/** Base a partir del total con IVA */
export function baseDesdeTotal(total: number, porcentaje: number) {
  if (porcentaje === 0) return round2(total);
  return round2(total / (1 + porcentaje / 100));
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function parseDecimal(raw: string) {
  const n = Number.parseFloat(String(raw).replace(",", ".").trim());
  return Number.isFinite(n) ? n : NaN;
}
