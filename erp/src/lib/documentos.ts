import { createClient } from "@/lib/supabase/client";
import {
  DOCUMENTOS_BUCKET,
  type CategoriaDocumento,
} from "@/types/database";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const MAX_BYTES = 10 * 1024 * 1024;

export function validateDocumentoFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Solo se permiten PDF, JPG o PNG.";
  }
  if (file.size > MAX_BYTES) {
    return "El archivo no puede superar 10 MB.";
  }
  return null;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

export async function uploadDocumentoFile(file: File, userId: string) {
  const validation = validateDocumentoFile(file);
  if (validation) return { error: validation };

  const supabase = createClient();
  const path = `${userId}/${Date.now()}_${sanitizeFileName(file.name)}`;

  const { error } = await supabase.storage
    .from(DOCUMENTOS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) return { error: error.message };

  return { path, error: null as string | null };
}

export async function getDocumentoSignedUrl(storagePath: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTOS_BUCKET)
    .createSignedUrl(storagePath, 60 * 30); // 30 min

  if (error) return { url: null as string | null, error: error.message };
  return { url: data.signedUrl, error: null as string | null };
}

export async function archiveDocumento(params: {
  file: File;
  nombre: string;
  categoria: CategoriaDocumento;
  proveedor_nombre?: string | null;
  gasto_id?: string | null;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión caducada." };

  const uploaded = await uploadDocumentoFile(params.file, user.id);
  if (uploaded.error || !uploaded.path) {
    return { error: uploaded.error ?? "Error al subir el archivo." };
  }

  const { data, error } = await supabase
    .from("documentos")
    .insert({
      nombre: params.nombre.trim() || params.file.name,
      url_archivo: uploaded.path,
      storage_path: uploaded.path,
      categoria: params.categoria,
      proveedor_nombre: params.proveedor_nombre?.trim() || null,
      gasto_id: params.gasto_id ?? null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    // rollback storage object
    await supabase.storage.from(DOCUMENTOS_BUCKET).remove([uploaded.path]);
    return { error: error.message };
  }

  return { id: data.id, error: null as string | null };
}

export async function deleteDocumentoCompleto(doc: {
  id: string;
  storage_path: string;
}) {
  const supabase = createClient();

  const { error: dbError } = await supabase
    .from("documentos")
    .delete()
    .eq("id", doc.id);

  if (dbError) return { error: dbError.message };

  const { error: storageError } = await supabase.storage
    .from(DOCUMENTOS_BUCKET)
    .remove([doc.storage_path]);

  // Si el objeto ya no existe en Storage, no bloqueamos
  if (storageError && !/not found|404/i.test(storageError.message)) {
    return { error: `BD borrada; Storage: ${storageError.message}` };
  }

  return { error: null as string | null };
}
