> Este módulo forma parte del monorepo **[CasaTorinoApp](https://github.com/Sebastian-Tamayo/CasaTorinoApp)**  
> (Web pública + ERP + Reservas del mismo negocio familiar).


# 🥘 Casa Torino - Web Project

¡Hola! Este es uno de mis primeros proyectos completos armando una página web desde cero. Lo hice para el restaurante de mi familia en Gijón, Asturias. 

<img width="982" height="910" alt="Page" src="https://github.com/user-attachments/assets/4cd7f56e-25fb-4b5b-a3f4-4e35959a9ed2" />

El concepto del restaurante es fusionar la cocina tradicional asturiana con el sazón de Colombia, así que el mayor reto fue reflejar eso en el diseño y en el código.

## 🛠️ Tecnologías que he utilizado
* **HTML5:** Para armar toda la estructura semántica de la web (secciones, header, footer).
* **CSS3:** Todo el estilo está escrito a mano sin frameworks para practicar a fondo. Utilicé CSS Variables (`:root`) para manejar la paleta de colores de las dos banderas y `CSS Grid` / `Flexbox` para que todo sea responsive y se adapte al móvil.
* **JavaScript Vanilla:** Programé una función sencilla utilizando el objeto `Date()` para crear un contador regresivo en vivo hasta el día de la gran inauguración.

## Cosas que aprendí haciendo esto
1. **Posicionamiento:** Me costó un poco hacer que la barra de navegación no se solapara con el texto al hacer scroll, pero lo solucioné jugando con `position: fixed` y ajustando el `z-index`.
2. **Filtros e Imágenes:** Aprendí a superponer colores oscuros sobre las fotos de fondo usando `linear-gradient` dentro de `background`, de esta forma las letras blancas tienen contraste y se leen perfectamente sin tener que editar la foto en Photoshop.
3. **Diseño de Layouts:** Utilicé CSS Grid para la sección de la historia familiar. Fue todo un reto hacer que en escritorio saliera en dos columnas y en móvil pasara a una sola, pero con `@media queries` quedó genial.

## Enlace de la página
https://casatorino.netlify.app/


¡Espero que os guste!
