"use client";

import { useEffect } from "react";
import { BarChart3, Calendar, CheckSquare, ChevronDown, Code2, Database, FilePlus2, Image as ImageIcon, Keyboard, LayoutTemplate, ListChecks, ListFilter, ListOrdered, Minus, MoreVertical, PanelRight, PieChart, Plus, Search, ScatterChart, SlidersHorizontal, Table2, TextCursorInput, ToggleLeft, Type, Undo2, Redo2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useEditorStore } from "@/store/editor-store";
import type { WidgetType } from "@/types";

const zoomValues = [0.5, 0.75, 1, 1.25];

const chartItems: { type: WidgetType; label: string; icon: React.ElementType }[] = [
  { type: "bar", label: "Barra", icon: BarChart3 },
  { type: "horizontal_bar", label: "Barra H", icon: BarChart3 },
  { type: "stacked_bar", label: "Apilada", icon: BarChart3 },
  { type: "line", label: "Línea", icon: BarChart3 },
  { type: "multi_line", label: "Multi línea", icon: BarChart3 },
  { type: "pie", label: "Torta", icon: PieChart },
  { type: "donut", label: "Dona", icon: PieChart },
  { type: "area", label: "Área", icon: BarChart3 },
  { type: "combo", label: "Combo", icon: BarChart3 },
  { type: "scatter", label: "Dispersión", icon: ScatterChart },
  { type: "table", label: "Tabla", icon: Table2 },
  { type: "pivot_table", label: "Tabla dinamica", icon: Table2 },
  { type: "scorecard", label: "Scorecard", icon: LayoutTemplate },
];

const contentItems: { type: WidgetType; label: string; icon: React.ElementType }[] = [
  { type: "control_text", label: "Control", icon: ListFilter },
  { type: "text", label: "Texto", icon: Type },
  { type: "image", label: "Imagen", icon: ImageIcon },
  { type: "kpi", label: "KPI", icon: TextCursorInput },
];

const controlItems: { type: WidgetType; label: string; icon: React.ElementType }[] = [
  { type: "control_select", label: "Añadir barra de filtros de lectores", icon: ListFilter },
  { type: "control_select", label: "Lista desplegable", icon: ListChecks },
  { type: "control_select", label: "Lista de tamaño fijo", icon: ListOrdered },
  { type: "control_text", label: "Cuadro de entrada", icon: Keyboard },
  { type: "control_text", label: "Filtro avanzado", icon: Search },
  { type: "control_text", label: "Control deslizante", icon: SlidersHorizontal },
  { type: "control_select", label: "Casilla", icon: CheckSquare },
  { type: "control_select", label: "Filtro predefinido", icon: ToggleLeft },
  { type: "control_date", label: "Filtro por periodo", icon: Calendar },
  { type: "control_select", label: "Control de datos", icon: BarChart3 },
  { type: "control_select", label: "Control de dimensiones", icon: Type },
  { type: "control_text", label: "Botón", icon: Plus },
];

export function ToolBar({ onAddData }: { onAddData?: () => void }) {
  const addWidget = useEditorStore((state) => state.addWidget);
  const addPage = useEditorStore((state) => state.addPage);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const setZoom = useEditorStore((state) => state.setZoom);
  const zoom = useEditorStore((state) => state.zoom);
  const selectedZoom = nearestZoomValue(zoom);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (isEditableTarget(event.target)) return;

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom(nextZoomValue(selectedZoom, 1));
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoom(nextZoomValue(selectedZoom, -1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedZoom, setZoom]);

  return (
    <div className="dh-toolbar flex h-11 shrink-0 items-center gap-0.5 overflow-x-auto border-b px-3">
      <ToolbarIcon label="Deshacer" onClick={undo}><Undo2 className="h-4 w-4" /></ToolbarIcon>
      <ToolbarIcon label="Rehacer" onClick={redo}><Redo2 className="h-4 w-4" /></ToolbarIcon>
      <Separator orientation="vertical" className="mx-1.5 h-5 bg-border" />
      <ZoomControl selectedZoom={selectedZoom} setZoom={setZoom} />
      <Separator orientation="vertical" className="mx-1.5 h-5 bg-border" />
      <Button variant="ghost" size="sm" className="h-8 rounded px-2.5 font-medium" onClick={addPage}>
        <FilePlus2 className="mr-2 h-4 w-4" />
        Añadir página
      </Button>
      <Button variant="ghost" size="sm" className="h-8 rounded px-2.5 font-medium" onClick={onAddData}>
        <Database className="mr-2 h-4 w-4" />
        Añadir datos
      </Button>
      <Button variant="ghost" size="sm" className="h-8 rounded px-2.5 font-medium" disabled>
        <PanelRight className="mr-2 h-4 w-4" />
        Combinar
      </Button>
      <Separator orientation="vertical" className="mx-1.5 h-5 bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Añadir gráfico" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <BarChart3 className="mr-1.5 h-4 w-4" />
          Añadir un gráfico
          <ChevronDown className="ml-1.5 h-3 w-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Graficos</DropdownMenuLabel>

            {chartItems.map((item) => {
              const Icon = item.icon;

              return (
                <DropdownMenuItem
                  key={item.type}
                  onClick={() => addWidget(item.type)}
                  className="h-8 cursor-pointer gap-2 px-2"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>

        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Mas graficos" className={buttonVariants({ variant: "ghost", size: "icon-sm", className: "h-8 rounded" })}>
          <SlidersHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Elementos rapidos</DropdownMenuLabel>
            {contentItems.filter((item) => item.type === "kpi" || item.type === "text" || item.type === "image").map((item) => {
              const Icon = item.icon;

              return (
                <DropdownMenuItem
                  key={item.type}
                  onClick={() => addWidget(item.type)}
                  className="h-8 cursor-pointer gap-2 px-2"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Separator orientation="vertical" className="mx-1.5 h-5 bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Añadir control" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ListFilter className="mr-1.5 h-4 w-4" />
          Añadir un control
          <ChevronDown className="ml-1.5 h-3 w-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Controles</DropdownMenuLabel>
            {controlItems.map((item) => {
              const Icon = item.icon;

              return (
                <DropdownMenuItem key={`${item.type}-${item.label}`} onClick={() => addWidget(item.type)} className="h-8 cursor-pointer gap-2 px-2">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Separator orientation="vertical" className="mx-1.5 h-5 bg-border" />
      <ToolbarIcon label="Codigo / insertar" disabled><Code2 className="h-4 w-4" /></ToolbarIcon>
      <ToolbarIcon label="Imagen" onClick={() => addWidget("image")}><ImageIcon className="h-4 w-4" /></ToolbarIcon>
      <ToolbarIcon label="Texto" onClick={() => addWidget("text")}><Type className="h-4 w-4" /></ToolbarIcon>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Mas herramientas" className={buttonVariants({ variant: "ghost", size: "icon-sm", className: "h-8 rounded" })}>
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Herramientas</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => addWidget("kpi")}>Añadir KPI</DropdownMenuItem>
            <DropdownMenuItem onClick={() => addWidget("table")}>Añadir tabla</DropdownMenuItem>
            <DropdownMenuItem onClick={() => addWidget("pivot_table")}>Añadir tabla dinamica</DropdownMenuItem>
            <DropdownMenuItem disabled>Insertar codigo</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* <Button variant="outline" size="sm" className="ml-auto">
        <Pause className="mr-2 h-4 w-4" />
        Pausar actualizaciones
      </Button> */}
    </div>
  );
}

function ToolbarIcon({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Button title={label} aria-label={label} variant="ghost" size="icon-sm" className="h-8 rounded" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}

function ZoomControl({ selectedZoom, setZoom }: { selectedZoom: number; setZoom: (zoom: number) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-xs"
        title="Alejar (Ctrl -)"
        aria-label="Alejar"
        onClick={() => setZoom(nextZoomValue(selectedZoom, -1))}
        disabled={selectedZoom <= zoomValues[0]}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span className="min-w-[44px] text-center font-mono text-xs text-foreground tabular-nums">
        {Math.round(selectedZoom * 100)}%
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        title="Acercar (Ctrl +)"
        aria-label="Acercar"
        onClick={() => setZoom(nextZoomValue(selectedZoom, 1))}
        disabled={selectedZoom >= zoomValues.at(-1)!}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function nearestZoomValue(value: number) {
  return zoomValues.reduce((nearest, item) => (Math.abs(item - value) < Math.abs(nearest - value) ? item : nearest), zoomValues[0]);
}

function nextZoomValue(current: number, direction: -1 | 1) {
  const index = zoomValues.indexOf(current);
  return zoomValues[Math.min(zoomValues.length - 1, Math.max(0, index + direction))];
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

