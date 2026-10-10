# Organización del repo — política y propuestas

Objetivo: **proyecto limpio para exposición a clientes**, intervenciones baratas en tokens, sin tocar una producción que ya funciona.

---

## 1. Estado acordado (oct 2026)

| Pieza | Política |
|---|---|
| `main` | Única rama de verdad = lo que debe poder desplegarse |
| Features | `cursor/<tema>-580d` → PR → merge → borrar rama |
| Backups | `backup/daily-YYYY-MM-DD` + tags `backup-YYYY-MM-DD`, **14 días**, workflow diario 03:00 Madrid |
| Docs | `docs/` + Cursor Rules `.cursor/rules/` (no cambian runtime) |
| Producción | No redeploy ni “limpiezas” de código estable sin petición explícita |

---

## 2. Limpieza aplicada en esta pasada

- Cierre de PRs draft antiguos no mergeados (superseded / no en prod).
- Borrado de ramas remotas `cursor/*` ya mergeadas en `main`.
- Borrado de ramas `cursor/*` huérfanas asociadas a esos drafts.
- Conservación íntegra del workflow de backup y de las ramas/tags dentro de la retención 14 días.
- Documentación madre: PRD, especificaciones, mapa de código, rules.

**No se ha modificado** HTML/JS/API de producción en esta pasada de organización.

---

## 3. Propuestas (para decidir contigo)

### A. Estructura de docs (recomendada — ya iniciada)
```text
docs/
  PRD.md                      ← documento madre producto
  COMERCIAL.md                ← venta / pitch
  ESPECIFICACIONES-TECNICAS.md
  TECNICO.md                  ← runbook ops/deploy/seguridad
  MAPA-CODIGO.md
  ORGANIZACION.md             ← este archivo
  media/                      ← demos
.cursor/rules/                ← ahorra tokens al agente
```

### B. Política de ramas (recomendada)
1. Máx. **1–2** ramas feature abiertas a la vez.
2. Tras merge: borrar rama remota el mismo día.
3. Nunca acumular drafts > 14 días sin merge o cierre.
4. Backups automáticos: no tocar a mano salvo recuperación.

### C. Ahorro de tokens en Cursor
1. Empezar pidiendo el **módulo** (“TPV notas”, “web menú”, “ERP top ventas”).
2. Las rules `alwaysApply` + globs llevan al archivo correcto.
3. Para docs: “solo docs, no tocar prod”.
4. Evitar “revisa todo el repo” — usar `MAPA-CODIGO.md`.

### D. Exposición a clientes
- README raíz = landing del repo (demos + enlaces).
- PRD + COMERCIAL = dossier.
- ESPECIFICACIONES = anexo técnico.
- Media en `docs/media/` ya lista para pantalla.

### E. Opcional más adelante
| Idea | Beneficio | Coste |
|---|---|---|
| `CHANGELOG.md` semanal | Historia clara | Bajo |
| Plantilla PR (checklist módulo) | Menos regresiones | Bajo |
| Tag `prod-YYYY-MM-DD` al deploy web | Trazabilidad | Bajo |
| Archivar PR factura ticket como “idea” | No se pierde | Ya cerrado como draft histórico |
| Dependabot solo `erp/` + `reservas/` | Seguridad deps | Medio |

---

## 4. Checklist pre-exposición

- [x] PRD + especificaciones + mapa
- [x] Cursor rules
- [x] Backup diario activo
- [ ] Ramas feature limpias (esta pasada)
- [ ] README apunta a docs madre
- [ ] Open PRs = 0 o solo trabajo activo

---

## 5. Qué no hacer

- No borrar `backup/daily-*` recientes ni el workflow.
- No reconectar Git a reservas “para probar”.
- No desplegar docs-only a Vercel.
- No reabrir Blob/Edge Config.
