/**
 * Descarga de informes ERP — Excel (.xls HTML) + vista PDF (imprimir).
 * Sin dependencias: máxima compatibilidad móvil/escritorio.
 */
import { round2 } from "@/lib/fiscal";
import type { TopPeriodo, TopProducto } from "@/lib/top-ventas";
import type { CierreItem } from "@/lib/cierres";

function formatImporte(n: number) {
  return round2(Number(n) || 0).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

function formatQty(qty: number) {
  const n = Number(qty) || 0;
  return Number.isInteger(n)
    ? String(n)
    : n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

function stampMadrid(now = new Date()) {
  return now.toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function slug(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type InformeTopVentasInput = {
  periodo: TopPeriodo;
  label: string;
  products: TopProducto[];
  tickets: number;
  total: number;
  fromOpenJornada?: boolean;
};

function buildTopVentasHtml(data: InformeTopVentasInput) {
  const when = stampMadrid();
  const rows = data.products
    .map((p, i) => {
      const avg = p.qty > 0 ? round2(p.total / p.qty) : 0;
      return `<tr>
        <td style="text-align:center;font-weight:800;color:#b8860b">${i + 1}º</td>
        <td style="font-weight:700">${escapeHtml(p.name)}</td>
        <td style="text-align:right">${escapeHtml(formatQty(p.qty))}</td>
        <td style="text-align:right">${escapeHtml(formatImporte(avg))}</td>
        <td style="text-align:right;font-weight:800">${escapeHtml(formatImporte(p.total))}</td>
      </tr>`;
    })
    .join("");

  const note = data.fromOpenJornada
    ? "Incluye jornada abierta (ventas cobradas en vivo)."
    : "Datos de cierres / jornada del periodo.";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Top ventas · ${escapeHtml(data.label)} · Casa Torino</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; margin: 0; padding: 24px; background: #fffaf0; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -.02em; }
  .eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #b8860b; margin: 0; }
  .meta { font-size: 12px; color: #555; margin: 8px 0 18px; line-height: 1.45; }
  .cards { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .card { background: #fff; border: 1px solid #e8d9a8; border-radius: 12px; padding: 10px 14px; min-width: 120px; }
  .card b { display: block; font-size: 18px; margin-top: 2px; }
  .card span { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #777; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; }
  th { background: #1a1a1a; color: #f5c518; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 10px 8px; text-align: left; }
  td { padding: 9px 8px; border-bottom: 1px solid #eee; font-size: 13px; }
  tr:nth-child(even) td { background: #fffdf6; }
  .foot { margin-top: 16px; font-size: 11px; color: #777; }
  @media print {
    body { background: #fff; padding: 0; }
    .noprint { display: none !important; }
  }
</style>
</head>
<body>
  <p class="eyebrow">Casa Torino · ERP</p>
  <h1>Productos más vendidos</h1>
  <p class="meta">
    <strong>Periodo:</strong> ${escapeHtml(data.label)}<br/>
    <strong>Generado:</strong> ${escapeHtml(when)} (Madrid)<br/>
    ${escapeHtml(note)}
  </p>
  <div class="cards">
    <div class="card"><span>Tickets</span><b>${data.tickets}</b></div>
    <div class="card"><span>Productos</span><b>${data.products.length}</b></div>
    <div class="card"><span>Total facturado</span><b>${escapeHtml(formatImporte(data.total))}</b></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:48px;text-align:center">#</th>
        <th>Producto</th>
        <th style="text-align:right">Uds</th>
        <th style="text-align:right">Precio medio</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="5" style="text-align:center;padding:20px;color:#888">Sin ventas en este periodo</td></tr>`}
    </tbody>
  </table>
  <p class="foot">Informe automático · Casa Torino · No modificar a mano si se archiva como oficial.</p>
  <p class="noprint" style="margin-top:20px">
    <button onclick="window.print()" style="padding:10px 16px;border:0;border-radius:10px;background:#f5c518;font-weight:800;cursor:pointer">
      Guardar / imprimir PDF
    </button>
  </p>
  <script>setTimeout(function(){ try { window.focus(); } catch(e) {} }, 200);</script>
</body>
</html>`;
}

/** Excel-compatible HTML spreadsheet (.xls) — se abre limpio en Excel / Sheets. */
function buildTopVentasExcelHtml(data: InformeTopVentasInput) {
  const when = stampMadrid();
  const rows = data.products
    .map((p, i) => {
      const avg = p.qty > 0 ? round2(p.total / p.qty) : 0;
      return `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${formatQty(p.qty).replace(/\./g, ",")}</td>
        <td>${avg.toFixed(2).replace(".", ",")}</td>
        <td>${round2(p.total).toFixed(2).replace(".", ",")}</td>
      </tr>`;
    })
    .join("");

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Top ventas</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  table { border-collapse: collapse; }
  th { background: #1a1a1a; color: #f5c518; font-weight: bold; padding: 6px; }
  td { border: 1px solid #ccc; padding: 5px; }
</style>
</head>
<body>
<h2>Casa Torino — Productos más vendidos</h2>
<p>Periodo: ${escapeHtml(data.label)} · Generado: ${escapeHtml(when)}
${data.fromOpenJornada ? " · Caja abierta en vivo" : ""}</p>
<p>Tickets: ${data.tickets} · Total: ${escapeHtml(formatImporte(data.total))}</p>
<table>
  <tr><th>#</th><th>Producto</th><th>Uds</th><th>Precio medio €</th><th>Total €</th></tr>
  ${rows}
</table>
</body></html>`;
}

/**
 * Descarga informe Top ventas:
 * 1) Excel (.xls) — mejor para revisar/filtrar
 * 2) Abre vista HTML lista para Guardar como PDF
 */
export function descargarInformeTopVentas(data: InformeTopVentasInput) {
  const base = `top-ventas-${slug(data.label)}-${new Date()
    .toISOString()
    .slice(0, 10)}`;

  const excel = buildTopVentasExcelHtml(data);
  downloadBlob(
    `${base}.xls`,
    new Blob([excel], {
      type: "application/vnd.ms-excel;charset=utf-8",
    }),
  );

  const html = buildTopVentasHtml(data);
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}

export type InformeCierresMesInput = {
  mesLabel: string;
  mesKey: string;
  total: number;
  tickets: number;
  comida: number;
  bebida: number;
  items: CierreItem[];
  efectivo?: number;
  tarjeta?: number;
  tip?: number;
};

export type InformeTotalesCierreInput = {
  dayKey: string;
  mesLabel?: string;
  startedAt?: number | null;
  endedAt?: number | null;
  tickets: number;
  total: number;
  comida: number;
  bebida: number;
  efectivo: number;
  tarjeta: number;
  tip: number;
  byProduct?: { id: string; name: string; qty: number; total: number }[];
};

function fmtHmInforme(ts?: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function euroCell(n: number) {
  return round2(n).toFixed(2).replace(".", ",");
}

function buildCierresMesHtml(data: InformeCierresMesInput) {
  const when = stampMadrid();
  const tipMes = round2(data.tip ?? 0);
  const efMes = round2(data.efectivo ?? 0);
  const tjMes = round2(data.tarjeta ?? 0);
  const rows = data.items
    .map((c) => {
      const ef = c.totals?.byPayment?.efectivo?.total ?? 0;
      const tj = c.totals?.byPayment?.tarjeta?.total ?? 0;
      const tip = c.totals?.tipTotal ?? 0;
      return `<tr>
        <td>${escapeHtml(c.dayKey)}</td>
        <td style="text-align:right">${c.totals?.tickets || 0}</td>
        <td style="text-align:right">${escapeHtml(formatImporte(c.totals?.byType?.comida?.total || 0))}</td>
        <td style="text-align:right">${escapeHtml(formatImporte(c.totals?.byType?.bebida?.total || 0))}</td>
        <td style="text-align:right">${escapeHtml(formatImporte(ef))}</td>
        <td style="text-align:right">${escapeHtml(formatImporte(tj))}</td>
        <td style="text-align:right">${escapeHtml(formatImporte(tip))}</td>
        <td style="text-align:right;font-weight:800">${escapeHtml(formatImporte(c.totals?.total || 0))}</td>
      </tr>`;
    })
    .join("");

  const foot = `<tr style="background:#1a1a1a;color:#fff">
      <td style="padding:8px 6px;font-weight:800">TOTAL MES</td>
      <td style="text-align:right;padding:8px 6px;font-weight:800">${data.tickets}</td>
      <td style="text-align:right;padding:8px 6px;font-weight:800">${escapeHtml(formatImporte(data.comida))}</td>
      <td style="text-align:right;padding:8px 6px;font-weight:800">${escapeHtml(formatImporte(data.bebida))}</td>
      <td style="text-align:right;padding:8px 6px;font-weight:800">${escapeHtml(formatImporte(efMes))}</td>
      <td style="text-align:right;padding:8px 6px;font-weight:800">${escapeHtml(formatImporte(tjMes))}</td>
      <td style="text-align:right;padding:8px 6px;font-weight:800">${escapeHtml(formatImporte(tipMes))}</td>
      <td style="text-align:right;padding:8px 6px;font-weight:800;color:#f5c518">${escapeHtml(formatImporte(data.total))}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Informe de totales · ${escapeHtml(data.mesLabel)} · Casa Torino</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: Georgia, serif; color: #1a1a1a; margin: 0; padding: 20px; background: #fffaf0; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #b8860b; }
  .meta { font-size: 12px; color: #555; margin: 8px 0 14px; }
  .cards { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .card { background: #fff; border: 1px solid #e8d9a8; border-radius: 12px; padding: 10px 14px; }
  .card b { display: block; font-size: 18px; margin-top: 2px; }
  .card span { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #777; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; background: #fff; font-size: 12px; }
  th { background: #1a1a1a; color: #f5c518; padding: 8px 6px; text-align: left; font-size: 10px; text-transform: uppercase; }
  td { padding: 7px 6px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: #fffdf6; }
  .note { margin-top: 12px; font-size: 11px; color: #666; }
  .noprint { margin-top: 16px; }
  @media print { body { background:#fff; padding:0 } .noprint { display:none !important } }
</style>
</head>
<body>
  <p class="eyebrow">Casa Torino · ERP · Caja TPV</p>
  <h1>Informe de totales · ${escapeHtml(data.mesLabel)}</h1>
  <p class="meta">Generado: ${escapeHtml(when)} (Madrid) · Mes ${escapeHtml(data.mesKey)} · Solo totales de cierres (sin listado de tickets)</p>
  <div class="cards">
    <div class="card"><span>Total mes</span><b>${escapeHtml(formatImporte(data.total))}</b></div>
    <div class="card"><span>Tickets</span><b>${data.tickets}</b></div>
    <div class="card"><span>Comida</span><b>${escapeHtml(formatImporte(data.comida))}</b></div>
    <div class="card"><span>Bebida</span><b>${escapeHtml(formatImporte(data.bebida))}</b></div>
    <div class="card"><span>Efectivo</span><b>${escapeHtml(formatImporte(efMes))}</b></div>
    <div class="card"><span>Tarjeta</span><b>${escapeHtml(formatImporte(tjMes))}</b></div>
    ${
      tipMes > 0
        ? `<div class="card"><span>Propina</span><b>${escapeHtml(formatImporte(tipMes))}</b></div>`
        : ""
    }
  </div>
  <table>
    <thead>
      <tr>
        <th>Día</th><th style="text-align:right">Tickets</th>
        <th style="text-align:right">Comida</th><th style="text-align:right">Bebida</th>
        <th style="text-align:right">Efectivo</th><th style="text-align:right">Tarjeta</th>
        <th style="text-align:right">Propina</th><th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="8" style="text-align:center;padding:16px;color:#888">Sin cierres</td></tr>`}
      ${data.items.length ? foot : ""}
    </tbody>
  </table>
  <p class="note">Los importes reflejan los cierres guardados en el ERP (incluidas correcciones de efectivo).</p>
  <p class="noprint">
    <button onclick="window.print()" style="padding:10px 16px;border:0;border-radius:10px;background:#f5c518;font-weight:800;cursor:pointer">
      Guardar / imprimir PDF
    </button>
  </p>
</body>
</html>`;
}

function buildCierresMesExcel(data: InformeCierresMesInput) {
  const when = stampMadrid();
  const tipMes = round2(data.tip ?? 0);
  const efMes = round2(data.efectivo ?? 0);
  const tjMes = round2(data.tarjeta ?? 0);
  const rows = data.items
    .map((c) => {
      const ef = c.totals?.byPayment?.efectivo?.total ?? 0;
      const tj = c.totals?.byPayment?.tarjeta?.total ?? 0;
      const tip = c.totals?.tipTotal ?? 0;
      return `<tr>
        <td>${escapeHtml(c.dayKey)}</td>
        <td>${c.totals?.tickets || 0}</td>
        <td>${euroCell(c.totals?.byType?.comida?.total || 0)}</td>
        <td>${euroCell(c.totals?.byType?.bebida?.total || 0)}</td>
        <td>${euroCell(ef)}</td>
        <td>${euroCell(tj)}</td>
        <td>${euroCell(tip)}</td>
        <td>${euroCell(c.totals?.total || 0)}</td>
      </tr>`;
    })
    .join("");

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" />
<style>th{background:#1a1a1a;color:#f5c518} td{border:1px solid #ccc;padding:4px}</style>
</head>
<body>
<h2>Casa Torino — Informe de totales ${escapeHtml(data.mesLabel)}</h2>
<p>Generado: ${escapeHtml(when)} (Madrid) · Solo totales · Sin listado de tickets</p>
<p>Total: ${escapeHtml(formatImporte(data.total))} · Tickets: ${data.tickets} · Comida: ${escapeHtml(formatImporte(data.comida))} · Bebida: ${escapeHtml(formatImporte(data.bebida))} · Efectivo: ${escapeHtml(formatImporte(efMes))} · Tarjeta: ${escapeHtml(formatImporte(tjMes))}${tipMes > 0 ? ` · Propina: ${escapeHtml(formatImporte(tipMes))}` : ""}</p>
<table>
<tr><th>Día</th><th>Tickets</th><th>Comida €</th><th>Bebida €</th><th>Efectivo €</th><th>Tarjeta €</th><th>Propina €</th><th>Total €</th></tr>
${rows}
<tr>
  <td><b>TOTAL MES</b></td>
  <td><b>${data.tickets}</b></td>
  <td><b>${euroCell(data.comida)}</b></td>
  <td><b>${euroCell(data.bebida)}</b></td>
  <td><b>${euroCell(efMes)}</b></td>
  <td><b>${euroCell(tjMes)}</b></td>
  <td><b>${euroCell(tipMes)}</b></td>
  <td><b>${euroCell(data.total)}</b></td>
</tr>
</table>
</body></html>`;
}

function openInformeWindow(html: string) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=1100,height=900");
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
    return true;
  }
  return false;
}

/** Informe de totales del mes (Excel + vista PDF). Sin listado de tickets. */
export function descargarInformeCierresMes(data: InformeCierresMesInput) {
  const base = `totales-${slug(data.mesKey)}-${new Date().toISOString().slice(0, 10)}`;
  downloadBlob(
    `${base}.xls`,
    new Blob([buildCierresMesExcel(data)], {
      type: "application/vnd.ms-excel;charset=utf-8",
    }),
  );
  openInformeWindow(buildCierresMesHtml(data));
}

/** Alias explícito: informe de totales del mes. */
export const descargarInformeTotalesMes = descargarInformeCierresMes;

function buildCierreTotalesHtml(data: InformeTotalesCierreInput) {
  const when = stampMadrid();
  const products = (data.byProduct || [])
    .slice(0, 40)
    .map(
      (p) => `<tr>
      <td>${escapeHtml(p.name)}</td>
      <td style="text-align:right">${escapeHtml(formatQty(p.qty))}</td>
      <td style="text-align:right;font-weight:700">${escapeHtml(formatImporte(p.total))}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Totales · ${escapeHtml(data.dayKey)} · Casa Torino</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Georgia, serif; color: #1a1a1a; margin: 0; padding: 24px; background: #fffaf0; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #b8860b; }
  .meta { font-size: 12px; color: #555; margin: 8px 0 14px; }
  .cards { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .card { background: #fff; border: 1px solid #e8d9a8; border-radius: 12px; padding: 10px 14px; min-width: 110px; }
  .card b { display: block; font-size: 18px; margin-top: 2px; }
  .card span { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #777; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; background: #fff; font-size: 13px; }
  th { background: #1a1a1a; color: #f5c518; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
  td { padding: 8px; border-bottom: 1px solid #eee; }
  .noprint { margin-top: 16px; }
  @media print { body { background:#fff; padding:0 } .noprint { display:none !important } }
</style>
</head>
<body>
  <p class="eyebrow">Casa Torino · ERP · Totales de cierre</p>
  <h1>${escapeHtml(data.dayKey)}</h1>
  <p class="meta">Generado: ${escapeHtml(when)} (Madrid) · Turno ${escapeHtml(fmtHmInforme(data.startedAt))} – ${escapeHtml(fmtHmInforme(data.endedAt))} · Solo totales</p>
  <div class="cards">
    <div class="card"><span>Total</span><b>${escapeHtml(formatImporte(data.total))}</b></div>
    <div class="card"><span>Tickets</span><b>${data.tickets}</b></div>
    <div class="card"><span>Comida</span><b>${escapeHtml(formatImporte(data.comida))}</b></div>
    <div class="card"><span>Bebida</span><b>${escapeHtml(formatImporte(data.bebida))}</b></div>
    <div class="card"><span>Efectivo</span><b>${escapeHtml(formatImporte(data.efectivo))}</b></div>
    <div class="card"><span>Tarjeta</span><b>${escapeHtml(formatImporte(data.tarjeta))}</b></div>
    ${
      data.tip > 0
        ? `<div class="card"><span>Propina</span><b>${escapeHtml(formatImporte(data.tip))}</b></div>`
        : ""
    }
  </div>
  ${
    products
      ? `<h2 style="font-size:16px;margin:0 0 8px">Productos (resumen)</h2>
  <table>
    <thead><tr><th>Producto</th><th style="text-align:right">Uds</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${products}</tbody>
  </table>`
      : ""
  }
  <p class="noprint">
    <button onclick="window.print()" style="padding:10px 16px;border:0;border-radius:10px;background:#f5c518;font-weight:800;cursor:pointer">
      Guardar / imprimir PDF
    </button>
  </p>
</body>
</html>`;
}

function buildCierreTotalesExcel(data: InformeTotalesCierreInput) {
  const when = stampMadrid();
  const products = (data.byProduct || [])
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.name)}</td><td>${formatQty(p.qty)}</td><td>${euroCell(p.total)}</td></tr>`,
    )
    .join("");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" /></head>
<body>
<h2>Casa Torino — Totales ${escapeHtml(data.dayKey)}</h2>
<p>Generado: ${escapeHtml(when)} · Turno ${escapeHtml(fmtHmInforme(data.startedAt))} – ${escapeHtml(fmtHmInforme(data.endedAt))}</p>
<table>
<tr><th>Concepto</th><th>Importe €</th></tr>
<tr><td>Total</td><td>${euroCell(data.total)}</td></tr>
<tr><td>Tickets</td><td>${data.tickets}</td></tr>
<tr><td>Comida</td><td>${euroCell(data.comida)}</td></tr>
<tr><td>Bebida</td><td>${euroCell(data.bebida)}</td></tr>
<tr><td>Efectivo</td><td>${euroCell(data.efectivo)}</td></tr>
<tr><td>Tarjeta</td><td>${euroCell(data.tarjeta)}</td></tr>
<tr><td>Propina</td><td>${euroCell(data.tip)}</td></tr>
</table>
${
  products
    ? `<h3>Productos</h3><table><tr><th>Producto</th><th>Uds</th><th>Total €</th></tr>${products}</table>`
    : ""
}
</body></html>`;
}

/** Totales de un cierre concreto (Excel + PDF). Sin listado de tickets. */
export function descargarInformeTotalesCierre(data: InformeTotalesCierreInput) {
  const base = `totales-${slug(data.dayKey)}-${new Date().toISOString().slice(0, 10)}`;
  downloadBlob(
    `${base}.xls`,
    new Blob([buildCierreTotalesExcel(data)], {
      type: "application/vnd.ms-excel;charset=utf-8",
    }),
  );
  openInformeWindow(buildCierreTotalesHtml(data));
}
