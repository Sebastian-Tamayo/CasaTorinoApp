# Producto — Reservas Casa Torino

## Visión
Herramienta operativa para que el equipo familiar capture y gestione reservas **en el momento**, sin romper la web de marca ni el ERP interno.

## Usuarios
Personal de sala/cocina (4 perfiles configurables). No es un portal de cliente final.

## Historias de uso
1. Cliente se acerca → personal abre la app → guarda nombre, personas, hora.  
2. Cambian de hora o se suman comensales → **Editar** → guardar.  
3. Al final del servicio → marcar Hecha / No vino / Anular.  
4. Vista **Todas** → ver fecha + hora sin abrir ficha.

## Métricas de éxito (negocio)
- Tiempo de alta &lt; 20–30 s  
- Misma información visible para todo el equipo  
- Menos reservas perdidas en papel/WhatsApp suelto  

## Relación con otros sistemas
- **Web** ([casatorino.netlify.app](https://casatorino.netlify.app)): captación y marca.  
- **App reservas (prod):** [reservas-casatorino.vercel.app](https://reservas-casatorino.vercel.app)  
- **ERP familiar**: continuidad operativa; este módulo aporta la capa de **ocupación/reservas** de forma ligera.

## Roadmap posible
- [ ] Fotos / GIF en README  
- [ ] Export CSV hacia ERP  
- [ ] Recordatorio WhatsApp automático  
- [ ] Roles (solo lectura / administración)
