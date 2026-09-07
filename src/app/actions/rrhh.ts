"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseDecimal, round2 } from "@/lib/fiscal";
import { mesActualKey, parseMesKey } from "@/lib/meses";

export type EmpleadoFormState = {
  error?: string;
  success?: boolean;
};

export type LiquidarState = {
  error?: string;
  success?: boolean;
  message?: string;
};

function revalidateRrhh() {
  revalidatePath("/gestion");
  revalidatePath("/gestion/rrhh");
  revalidatePath("/gestion/historial");
  revalidatePath("/gestion/fiscal");
  revalidatePath("/gestion/proveedores");
}

export async function upsertEmpleado(
  _prev: EmpleadoFormState,
  formData: FormData,
): Promise<EmpleadoFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const puesto = String(formData.get("puesto") ?? "").trim();
  const salario_bruto = parseDecimal(String(formData.get("salario_bruto") ?? ""));
  const coste_seguridad_social = parseDecimal(
    String(formData.get("coste_seguridad_social") ?? "0"),
  );
  const porcentaje_retencion_irpf = parseDecimal(
    String(formData.get("porcentaje_retencion_irpf") ?? "0"),
  );

  if (!nombre || !puesto) {
    return { error: "Nombre y puesto son obligatorios." };
  }
  if (!Number.isFinite(salario_bruto) || salario_bruto < 0) {
    return { error: "Salario bruto no válido." };
  }
  if (!Number.isFinite(coste_seguridad_social) || coste_seguridad_social < 0) {
    return { error: "Coste SS no válido." };
  }
  if (
    !Number.isFinite(porcentaje_retencion_irpf) ||
    porcentaje_retencion_irpf < 0 ||
    porcentaje_retencion_irpf > 100
  ) {
    return { error: "Retención IRPF no válida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión caducada." };

  const payload = {
    nombre,
    puesto,
    salario_bruto,
    coste_seguridad_social,
    porcentaje_retencion_irpf,
    activo: true,
  };

  const { error } = id
    ? await supabase.from("empleados").update(payload).eq("id", id)
    : await supabase.from("empleados").insert(payload);

  if (error) return { error: error.message };

  revalidateRrhh();
  return { success: true };
}

export async function deleteEmpleado(id: string): Promise<EmpleadoFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión caducada." };

  const { error } = await supabase
    .from("empleados")
    .update({ activo: false })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateRrhh();
  return { success: true };
}

/** Liquida nóminas del mes actual: nominas_pagadas + gasto 'Nóminas y SS' */
export async function liquidarMes(): Promise<LiquidarState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión caducada." };

  const mesKey = mesActualKey();
  const { year, monthIndex } = parseMesKey(mesKey);
  const mesAnio = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const mesLabel = new Date(year, monthIndex, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  const { data: empleados, error: empError } = await supabase
    .from("empleados")
    .select("*")
    .eq("activo", true);

  if (empError) return { error: empError.message };
  if (!empleados?.length) {
    return { error: "No hay empleados activos para liquidar." };
  }

  let liquidados = 0;
  let omitidos = 0;

  for (const emp of empleados) {
    const bruto = Number(emp.salario_bruto);
    const ss = Number(emp.coste_seguridad_social);
    const irpfPct = Number(emp.porcentaje_retencion_irpf);
    const irpf = round2((bruto * irpfPct) / 100);
    const neto = round2(bruto - irpf);
    const costeTotal = round2(bruto + ss);

    const { error: nominaError } = await supabase.from("nominas_pagadas").insert({
      empleado_id: emp.id,
      mes_anio: mesAnio,
      importe_neto: neto,
      importe_irpf: irpf,
    });

    if (nominaError) {
      // Unique violation → ya liquidado este mes
      if (nominaError.code === "23505") {
        omitidos += 1;
        continue;
      }
      return { error: `Nómina ${emp.nombre}: ${nominaError.message}` };
    }

    const { error: gastoError } = await supabase.from("gastos").insert({
      importe: costeTotal,
      concepto: `Nómina ${emp.nombre} · ${mesLabel}`,
      categoria: "Nóminas y SS",
      origen_fondos: "Banco",
      proveedor_nombre: null,
      base_imponible: costeTotal,
      porcentaje_iva: 0,
      user_id: user.id,
    });

    if (gastoError) {
      return { error: `Gasto nómina ${emp.nombre}: ${gastoError.message}` };
    }

    liquidados += 1;
  }

  revalidateRrhh();

  if (liquidados === 0 && omitidos > 0) {
    return {
      error: `Todas las nóminas de ${mesLabel} ya estaban liquidadas.`,
    };
  }

  return {
    success: true,
    message: `Liquidadas ${liquidados} nómina(s)${
      omitidos ? ` (${omitidos} ya existían)` : ""
    }.`,
  };
}
