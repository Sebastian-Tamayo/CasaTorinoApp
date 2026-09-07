"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  FolderOpen,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { MonthSelector } from "@/components/month-selector";
import { showToast } from "@/components/toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  archiveDocumento,
  deleteDocumentoCompleto,
  getDocumentoSignedUrl,
} from "@/lib/documentos";
import { createClient } from "@/lib/supabase/client";
import {
  labelMes,
  listarMesesHistorico,
  mesActualKey,
  rangoMes,
  type MesKey,
} from "@/lib/meses";
import {
  CATEGORIAS_DOCUMENTO,
  type CategoriaDocumento,
  type Documento,
} from "@/types/database";

function labelCategoria(cat: CategoriaDocumento) {
  return CATEGORIAS_DOCUMENTO.find((c) => c.value === cat)?.label ?? cat;
}

function isPdf(nombre: string, path: string) {
  return /\.pdf$/i.test(nombre) || /\.pdf$/i.test(path);
}

function isImage(nombre: string, path: string) {
  return /\.(jpe?g|png|webp)$/i.test(nombre) || /\.(jpe?g|png|webp)$/i.test(path);
}

export function DocumentosView() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mesKey, setMesKey] = useState<MesKey | "all">(() => mesActualKey());
  const [categoria, setCategoria] = useState<CategoriaDocumento | "all">("all");
  const [proveedorFilter, setProveedorFilter] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState<{
    doc: Documento;
    url: string;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Documento | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      let query = supabase
        .from("documentos")
        .select("*")
        .order("created_at", { ascending: false });

      if (mesKey !== "all") {
        const { inicioISO, finISO } = rangoMes(mesKey);
        query = query.gte("created_at", inicioISO).lte("created_at", finISO);
      }

      if (categoria !== "all") {
        query = query.eq("categoria", categoria);
      }

      const { data, error: qError } = await query;
      if (cancelled) return;

      if (qError) {
        setError(qError.message);
        setDocs([]);
      } else {
        setDocs((data as Documento[]) ?? []);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [mesKey, categoria, refreshTick]);

  const filtered = useMemo(() => {
    const q = proveedorFilter.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) =>
      (d.proveedor_nombre ?? "").toLowerCase().includes(q),
    );
  }, [docs, proveedorFilter]);

  async function openPreview(doc: Documento) {
    const { url, error: sError } = await getDocumentoSignedUrl(doc.storage_path);
    if (sError || !url) {
      showToast(sError ?? "No se pudo abrir el archivo", "error");
      return;
    }
    setPreview({ doc, url });
  }

  async function downloadDoc(doc: Documento) {
    const { url, error: sError } = await getDocumentoSignedUrl(doc.storage_path);
    if (sError || !url) {
      showToast(sError ?? "No se pudo descargar", "error");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.nombre;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await deleteDocumentoCompleto(pendingDelete);
    setDeleting(false);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    setPendingDelete(null);
    setPreview(null);
    setRefreshTick((t) => t + 1);
    showToast("Documento eliminado");
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl text-ink">Documentos</h1>
        <p className="mt-1 text-sm text-ink/55">
          Archivo digital · gestoría y documentación
        </p>
      </header>

      <button
        type="button"
        onClick={() => setShowUpload((v) => !v)}
        className="flex min-h-touch items-center justify-center gap-2 rounded-tpv bg-azul-colombia text-sm font-bold text-white shadow-tpv"
      >
        <Upload className="size-4" aria-hidden />
        {showUpload ? "Cerrar subida" : "Subir documento"}
      </button>

      {showUpload ? (
        <UploadForm
          onDone={() => {
            setShowUpload(false);
            setRefreshTick((t) => t + 1);
            showToast("Documento archivado");
          }}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">
            Mes
          </span>
          <select
            value={mesKey}
            onChange={(e) =>
              setMesKey(e.target.value === "all" ? "all" : e.target.value)
            }
            className="min-h-touch rounded-tpv border border-ink/10 bg-card px-4 text-sm font-semibold text-ink shadow-tpv"
          >
            <option value="all">Todos los meses</option>
            {listarMesesHistorico(18).map((k) => (
              <option key={k} value={k}>
                {labelMes(k)}
              </option>
            ))}
          </select>
        </label>

        {mesKey !== "all" ? (
          <div className="hidden">
            <MonthSelector value={mesKey} onChange={setMesKey} />
          </div>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">
            Categoría
          </span>
          <select
            value={categoria}
            onChange={(e) =>
              setCategoria(
                e.target.value === "all"
                  ? "all"
                  : (e.target.value as CategoriaDocumento),
              )
            }
            className="min-h-touch rounded-tpv border border-ink/10 bg-card px-4 text-sm font-semibold text-ink shadow-tpv"
          >
            <option value="all">Todas</option>
            {CATEGORIAS_DOCUMENTO.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">
            Proveedor
          </span>
          <input
            type="search"
            value={proveedorFilter}
            onChange={(e) => setProveedorFilter(e.target.value)}
            placeholder="Filtrar por nombre…"
            className="min-h-touch rounded-tpv border border-ink/10 bg-card px-4 text-sm text-ink shadow-tpv"
          />
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-ink/50">Cargando…</p>
      ) : error ? (
        <p className="rounded-tpv bg-rojo-colombia/10 px-4 py-3 text-sm text-rojo-colombia">
          {error}
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-tpv-lg bg-card px-6 py-10 text-center shadow-tpv">
          <FolderOpen className="mx-auto size-8 text-ink/30" aria-hidden />
          <p className="mt-3 font-display text-lg text-ink">Sin documentos</p>
          <p className="mt-1 text-sm text-ink/55">
            Sube facturas, albaranes o contratos para archivarlos aquí.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((doc) => (
            <li
              key={doc.id}
              className="rounded-tpv-lg bg-card p-4 shadow-tpv"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-tpv bg-cream text-azul-colombia">
                  <FileText className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{doc.nombre}</p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {labelCategoria(doc.categoria)}
                    {doc.proveedor_nombre ? ` · ${doc.proveedor_nombre}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs capitalize text-ink/40">
                    {new Date(doc.created_at).toLocaleString("es-ES", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => void openPreview(doc)}
                  className="flex min-h-10 items-center justify-center gap-1 rounded-tpv border border-ink/10 text-xs font-semibold text-ink"
                >
                  <Eye className="size-3.5" /> Ver
                </button>
                <button
                  type="button"
                  onClick={() => void downloadDoc(doc)}
                  className="flex min-h-10 items-center justify-center gap-1 rounded-tpv border border-ink/10 text-xs font-semibold text-ink"
                >
                  <Download className="size-3.5" /> Descargar
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(doc)}
                  className="flex min-h-10 items-center justify-center gap-1 rounded-tpv border border-rojo-colombia/25 bg-rojo-colombia/10 text-xs font-semibold text-rojo-colombia"
                >
                  <Trash2 className="size-3.5" /> Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {preview ? (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-ink/70 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa del documento"
        >
          <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 rounded-t-tpv bg-card px-3 py-2">
            <p className="truncate text-sm font-semibold text-ink">
              {preview.doc.nombre}
            </p>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="flex size-9 items-center justify-center rounded-tpv text-ink"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="mx-auto min-h-0 w-full max-w-lg flex-1 overflow-hidden rounded-b-tpv bg-card">
            {isPdf(preview.doc.nombre, preview.doc.storage_path) ? (
              <iframe
                title={preview.doc.nombre}
                src={preview.url}
                className="h-full min-h-[70dvh] w-full"
              />
            ) : isImage(preview.doc.nombre, preview.doc.storage_path) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url}
                alt={preview.doc.nombre}
                className="mx-auto max-h-[75dvh] w-full object-contain p-2"
              />
            ) : (
              <p className="p-6 text-center text-sm text-ink/55">
                Vista previa no disponible. Usa Descargar.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        tipo="documento"
        importeLabel={pendingDelete?.nombre ?? "documento"}
        pending={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] =
    useState<CategoriaDocumento>("factura_proveedor");
  const [proveedor, setProveedor] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Selecciona un archivo.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await archiveDocumento({
      file,
      nombre: nombre || file.name,
      categoria,
      proveedor_nombre: proveedor,
    });
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onDone();
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-3 rounded-tpv-lg bg-card p-4 shadow-tpv"
    >
      <h2 className="font-display text-lg text-ink">Nuevo archivo</h2>
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        required
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      <input
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre del documento"
        className="min-h-touch rounded-tpv border border-ink/10 px-3 text-sm"
      />
      <select
        value={categoria}
        onChange={(e) => setCategoria(e.target.value as CategoriaDocumento)}
        className="min-h-touch rounded-tpv border border-ink/10 px-3 text-sm"
      >
        {CATEGORIAS_DOCUMENTO.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={proveedor}
        onChange={(e) => setProveedor(e.target.value)}
        placeholder="Proveedor (opcional)"
        className="min-h-touch rounded-tpv border border-ink/10 px-3 text-sm"
      />
      {error ? <p className="text-sm text-rojo-colombia">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-touch rounded-tpv bg-esmeralda text-sm font-bold text-white disabled:opacity-50"
      >
        {pending ? "Subiendo…" : "Archivar"}
      </button>
    </form>
  );
}
