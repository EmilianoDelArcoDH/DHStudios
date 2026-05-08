# DH Studio

Plataforma web tipo Looker Studio para crear reportes editables con canvas, widgets, fuentes de datos y exportacion JSON.

## Flujo obligatorio

- `/`: Home inicial. Permite crear un proyecto o abrir uno por `projectId`.
- `/editor/[projectId]`: editor del proyecto.
- `/view/[projectId]`: vista publica readonly si el proyecto esta compartido.

La Home no lista proyectos. Para abrir un proyecto existente se debe ingresar directamente su `projectId`.

## Identificador de proyecto

Cada reporte tiene un `projectId` unico e inmutable generado con `crypto.randomUUID()` al crear el proyecto.

El `projectId` se guarda y se usa en:

- rutas internas
- base de datos
- paginas
- widgets
- fuentes de datos
- links publicos
- export/import JSON

El nombre del proyecto puede repetirse. El `projectId` no.

## Stack

- Next.js + TypeScript + Tailwind CSS
- shadcn/ui + lucide-react
- Zustand
- React Grid Layout
- Apache ECharts
- TanStack Table
- Supabase/PostgreSQL

## Instalacion

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abrir `http://localhost:3000`.

## Variables de entorno

Crear `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

Sin estas variables la app corre en modo local usando `localStorage`. Con Supabase configurado, auth y guardado automatico persisten en PostgreSQL.

## Base de datos

Ejecutar [db/schema.sql](db/schema.sql) en el SQL editor de Supabase.

Tablas:

- `reports`: `id` interno opcional, `project_id` unico, `name`, `owner_id`, `is_public`, `theme`.
- `report_pages`: pertenencia por `project_id`.
- `datasets`: pertenencia por `project_id`.
- `widgets`: pertenencia por `project_id` y `page_id`.

## Funcionalidad incluida

- Home inicial sin listado general de proyectos.
- Crear proyecto con `crypto.randomUUID()`.
- Buscar proyecto directo por `projectId`.
- Autenticacion Supabase por email/password.
- CRUD en estado para reportes, paginas, widgets y datasets.
- Canvas con grilla, zoom, drag and resize.
- Modo editar/ver y vista readonly.
- Autosave con Supabase si esta configurado.
- Undo/redo basico.
- CSV upload, URL publica CSV/Google Sheets y datos demo.
- Columnas tipadas e inferidas.
- Graficos: barra, linea, torta, area, tabla, KPI y scorecard.
- Configuracion visual de dataset, dimension, metrica, agregacion, orden y limite.
- Panel de estilo con titulo, texto, colores, fondo, borde, leyenda e imagen.
- Temas del reporte.
- Exportar/importar JSON con `projectId`.

## Scripts

```bash
npm run dev
npm run build
npm run lint
```
