# Tema claro de la web pública (obligatorio)

La web pública de Casa Torino debe ser **clara/crema** (`#fff8e8`), nunca oscura.

## Por qué se rompía
Al desplegar TPV/Cocina desde una carpeta con `styles.css` oscuro, Vercel
subía también ese CSS y **pisaba** la web pública.

## Regla
1. `styles.css` e `index.html` de la web pública SIEMPRE tema claro.
2. Antes de cualquier deploy: `bash scripts/assert-light-theme.sh`
3. Deploy recomendado: `bash scripts/deploy-web.sh`
4. El TPV y Cocina pueden seguir oscuros (tienen CSS propio embebido).

## Comprobación rápida
```bash
grep -F '--bg: #fff8e8' styles.css
grep -F 'theme-color" content="#fff8e8"' index.html
```
