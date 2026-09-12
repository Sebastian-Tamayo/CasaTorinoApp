"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseDecimal, totalConIva } from "@/lib/fiscal";
import type { CategoriaIngreso, MetodoPago } from "@/types/database";
import { CATEGORIAS_INGRESO, METODOS_PAGO } from "@/types/database";

export type IngresoFormState = {
  error?: string;
  success?: boolean;
};

export async function createIngreso(
  _prev: IngresoFormState,
  formData: FormData,
): Promise<IngresoFormState> {
  const categoria = String(formData.get("categoria") ?? "") as CategoriaIngreso;
  const metodo_pago = String(formData.get("metodo_pago") ?? "") as MetodoPago;
  const base_imponible = parseDecimal(String(formData.get("base_imponible") ?? ""));
  const porcentaje_iva = parseDecimal(
    String(formData.get("porcentaje_iva") ?? "10"),
  );

  if (!CATEGORIAS_INGRESO.some((c) => c.value === categoria)) {
    return { error: "Selecciona una categoría de ingreso." };
  }
  if (!METODOS_PAGO.some((m) => m.value === metodo_pago)) {
    return { error: "Selecciona el método de pago." };
  }
  if (!Number.isFinite(base_imponible) || base_imponible <= 0) {
    return { error: "Introduce una base imponible válida." };
  }
  if (!Number.isFinite(porcentaje_iva) || porcentaje_iva < 0 || porcentaje_iva > 100) {
    return { error: "IVA no válido." };
  }

  const importe = totalConIva(base_imponible, porcentaje_iva);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión caducada. Vuelve a iniciar sesión." };
  }

  const { error } = await supabase.from("ingresos").insert({
    importe,
    categoria,
    metodo_pago,
    base_imponible,
    porcentaje_iva,
    user_id: user.id,
  });

  if (error) {
    return { error: `No se pudo guardar el ingreso: ${error.message}` };
  }

  revalidatePath("/gestion");
  revalidatePath("/gestion/historial");
  revalidatePath("/gestion/fiscal");
  return { success: true };
}
