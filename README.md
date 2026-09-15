# Casa Torino App — Ecosistema familiar

Respaldo canónico del negocio **Casa Torino** (Gijón): web pública, TPV, cocina (KDS), reservas y ERP.

> Empresa familiar. Este repositorio es el **backup continuo** del software operativo.
> **Nunca** subas PINs, tokens ni `.env` reales a GitHub.

## Módulos

| Carpeta | Qué es | Producción |
|---------|--------|------------|
| `web/` | Web pública clara + Gestión interna + **TPV** + **Cocina** | https://casa-torino-web.vercel.app |
| `reservas/` | App de reservas staff | https://reservas-casatorino.vercel.app |
| `erp/` | Back-office (Next.js + Supabase) | https://casa-torino-app.vercel.app |
| `docs/` | Recuperación y anti-regresión | — |

## Estado actual (15 sep 2026)

Respaldo alineado con producción (`casa-torino-web` en Vercel). Cambios importantes desde el último push:

### Carta / precios
- Menú entre semana: **español 14 €** · **colombiano 13 €**
- Fin de semana: español 18 € · colombiano 15 € (sin cambio)
- **Refrescos 2,50 €** (antes 2,80 €)
- Categoría **Cafés** separada de bebidas (café, café con leche, infusión, té frío)
- **Postres** van a barra (no a cocina)

### TPV (punto de venta)
- Precio **editable en la cuenta** solo en **menús** y en productos **Varios / libre**
- Nueva categoría **Varios**: producto libre (nombre + precio) para pan, encargos, etc.
- **Ticket** = imprime sin cerrar mesa ni abrir cajón
- **Cobrar** = registra jornada, abre cajón, limpia mesa (sin reimprimir)
- Scroll táctil en caja Windows (pantalla ancha ≥1024px); en **móvil** scroll nativo (evita pantalla trabada)
- Campos editables con teclado (mesa, notas, precios)
- Aviso **Recoger mesa X** al marcar Listo en cocina
- Sync / jornada / cocina vía **Supabase `ops_kv`** (con fallback histórico)

### Cocina (KDS)
- Menú **español** en 2 tiempos: Listo 1º → TPV recoge y sigue `waiting_next`; Listo 2º cierra
- Menús **colombianos**: un solo Listo
- Impresión / QZ Tray para POS-58

### Web pública
- Tema claro/crema (`#fff8e8`)
- Carta en móvil sin cajas de scroll internas que atasquen el dedo
- Precios de menú del día alineados con TPV

### Accesos
- PIN obligatorio al entrar en TPV / Cocina / Interno (`TPV_PIN` solo en Vercel)

### Clonar en otro equipo

```bash
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git
cd CasaTorinoApp
```

Los secretos (`BLOB_READ_WRITE_TOKEN`, PIN, tokens Supabase/Vercel) están en **Vercel** (proyecto `casa-torino-web`), no en el repo. Para desarrollar en local: copiar a `web/.env.local` (no se sube a Git).

## Accesos (PIN en Vercel, no en el código)

- **Gestión interna / TPV / Cocina**: PIN del personal (`TPV_PIN` en Vercel) — se pide **siempre** al abrir.
- Tema web pública: **claro/crema** (`#fff8e8`). No sustituir por oscuro al desplegar TPV.

## Deploy seguro (web)

```bash
cd web
bash scripts/assert-light-theme.sh   # falla si el tema no es claro
bash scripts/deploy-web.sh           # deploy a producción
```

Producción actual: https://casa-torino-web.vercel.app

## Variables de entorno (Vercel)

### Web / TPV / Cocina (`casa-torino-web`)
- `TPV_PIN`
- Credenciales Supabase / ops (`ops_kv`) según `docs/RECUPERACION.md`
- `TPV_EDGE_CONFIG_ID` / `TPV_TEAM_ID` / `TPV_VERCEL_TOKEN` (legado / fallback)
- `TPV_SYNC_KEY` (opcional)
- QZ / impresión según configuración del POS

### Reservas (`reservas-casatorino`)
- `RESERVAS_EDGE_CONFIG_ID` (o `TPV_EDGE_CONFIG_ID`)
- `RESERVAS_TEAM_ID`
- `RESERVAS_VERCEL_TOKEN`
- Root Directory = `reservas`
- **No reconectar Git** hasta confirmar store Edge Config (ver `docs/reservas-ANTI-REGRESION.md`)

## Histórico de cocina
Los pedidos marcados como **Listo** se guardan en histórico del día y se borran a las **09:00** (Europe/Madrid).

## Recuperación y subida a GitHub
- Recuperación general: `docs/RECUPERACION.md` y `docs/casatorino-sync/`
- Subir respaldo: `docs/SUBIR-GITHUB.md` y `scripts/subir-github.sh`
- Si Cursor no puede hacer push a este repo, el espejo de emergencia está en **Proyeccion** (rama `backup/casa-torino-app`): ver `docs/SUBIR-GITHUB.md`

## Reglas de oro
1. Web pública siempre **clara**.
2. Secretos solo en Vercel / `.env.local` (gitignored).
3. TPV, Cocina e Interna **siempre** piden PIN al entrar.
4. Reservas usan **Edge Config**, no CrudCrud.
5. Hacer push frecuente a este repo: es el respaldo de la empresa.
6. En móvil no forzar `touch-action: none` del TPV de caja (rompe el scroll).

---
Casa Torino · Gijón
