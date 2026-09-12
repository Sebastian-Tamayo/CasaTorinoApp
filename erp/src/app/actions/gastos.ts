"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseDecimal, totalConIva } from "@/lib/fiscal";
import type { CategoriaGasto, OrigenFondos } from "@/types/database";
import { CATEGORIAS } from "@/types/database";

export type GastoFormState = {
  error?: string;
  success?: boolean;
  gastoId?: string;
  proveedor_nombre?: string | null;
};

const ORIGENES: OrigenFondos[] = ["Efectivo_Caja", "Banco"];

export async function createGasto(
  _prev: GastoFormState,
  formData: FormData,
): Promise<GastoFormState> {
  const concepto = String(formData.get("concepto") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "") as CategoriaGasto;
  const origen_fondos = String(
    formData.get("origen_fondos") ?? "",
  ) as OrigenFondos;
  const proveedor_nombre =
    String(formData.get("proveedor_nombre") ?? "").trim() || null;
  const base_imponible = parseDecimal(String(formData.get("base_imponible") ?? ""));
  const porcentaje_iva = parseDecimal(String(formData.get("porcentaje_iva") ?? "0"));

  if (!concepto) {
    return { error: "El concepto es obligatorio." };
  }
  if (!CATEGORIAS.includes(categoria)) {
    return { error: "Selecciona una categoría." };
  }
  if (!ORIGENES.includes(origen_fondos)) {
    return { error: "Selecciona el origen de los fondos." };
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

  const { data, error } = await supabase
    .from("gastos")
    .insert({
      importe,
      concepto,
      categoria,
      origen_fondos,
      proveedor_nombre,
      base_imponible,
      porcentaje_iva,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: `No se pudo guardar el gasto: ${error.message}` };
  }

  revalidatePath("/gestion");
  revalidatePath("/gestion/historial");
  revalidatePath("/gestion/proveedores");
  revalidatePath("/gestion/fiscal");
  revalidatePath("/gestion/documentos");
  return {
    success: true,
    gastoId: data.id,
    proveedor_nombre,
  };
}
