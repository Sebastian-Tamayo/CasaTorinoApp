# Casa Torino — Web pública (principal)

Página de marca del bar-restaurante **Casa Torino** (Gijón).  
Fusión Colombo-Asturiana · carta con precios · menú del día · equipo · contacto · hub de gestión interna.

## Producción
**https://casa-torino-web.vercel.app**

## Stack
HTML/CSS/JS estático · Vercel (Root Directory = `web`).

## Local
```bash
npx serve .
```

## Estructura
```text
web/
├── index.html          ← web principal
├── interno.html        ← Gestión interna (Reservas + ERP)
├── styles.css
├── main.js
├── assets/
└── archivo/
    └── inauguracion/   ← archivo histórico de inauguración (no principal)
```

## Enlaces del ecosistema
- Clientes reservan: WhatsApp  
- Reservas staff: https://reservas-casatorino.vercel.app  
- ERP: https://casa-torino-app.vercel.app/login  
- Inauguración (archivo): https://casatorino.netlify.app  
- Monorepo: https://github.com/Sebastian-Tamayo/CasaTorinoApp
