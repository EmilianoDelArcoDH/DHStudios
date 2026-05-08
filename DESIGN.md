# DESIGN.md

## Objetivo

La plataforma debe mantener una experiencia de estructura y uso familiar para estudiantes que conocen Looker Studio: barra superior, segunda toolbar, panel izquierdo, canvas central, panel derecho y widgets editables.

La identidad Digital House se aplica como una capa institucional sutil. No debe convertir el producto en una landing ni en una pieza promocional.

## Supuesto de marca

No hay assets propietarios en el repositorio. Esta guia usa una interpretacion moderada del brandbook Digital House ya presente en el proyecto: alto contraste, blanco/negro, azul institucional, acentos secundarios y lenguaje educativo claro.

## Tipografia

- Interfaz base: Geist Sans por consistencia con Next.js y shadcn/ui.
- Titulos y acciones principales: peso 600 o 700.
- Datos, IDs, projectId y valores tecnicos: Geist Mono.
- No usar tracking negativo.
- Mantener jerarquia compacta en paneles y toolbars.

## Color

Base:

- Blanco: `#ffffff`
- Negro: `#000000`
- Gris texto: `#333333`
- Gris interfaz: `#f4f5f7`
- Gris borde: `#d8dbe1`

Acento Digital House:

- Azul DH: `#3333ff`

Acentos secundarios, solo para estados, chips o series de graficos:

- Verde: `#00cc7e`
- Amarillo: `#ffc51a`
- Naranja: `#ff7059`
- Rosa: `#ff76e2`
- Lila: `#8a6df1`

## Uso de color

- La UI principal debe seguir siendo blanca y gris, como herramienta productiva.
- El azul DH se usa para acciones primarias, foco y detalles de marca.
- Evitar fondos saturados en editor y canvas.
- Los widgets deben conservar fondo blanco y bordes neutros.

## Accesibilidad

- Contraste AA minimo para texto normal.
- Botones primarios con texto blanco sobre azul DH.
- No depender solo del color para estados.
- Inputs, selects y switches deben conservar foco visible.
- El `projectId` debe mostrarse con fuente mono y poder copiarse desde acciones de compartir o JSON.

## Espaciado y forma

- Toolbars compactas.
- Paneles densos, escaneables y sin cards anidadas.
- Radius maximo recomendado: 6px en superficies de producto.
- Canvas blanco sobre fondo gris claro.
- Sombras muy suaves, solo para separar widgets del canvas.

## Lenguaje

Usar espanol claro, directo y educativo:

- Crear nuevo proyecto
- Buscar proyecto por ID
- Abrir proyecto
- Fuente de datos
- Dimension
- Metrica
- Compartir
- Modo edicion
- Modo visualizacion

Evitar tecnicismos si no son necesarios.

## Reglas de identidad

- No copiar logos, marcas ni assets propietarios de Looker Studio.
- No usar assets de Digital House si no estan presentes o licenciados en el proyecto.
- No alterar la arquitectura UX principal tipo Looker Studio.
- La identidad DH debe sentirse institucional, moderada y consistente.
