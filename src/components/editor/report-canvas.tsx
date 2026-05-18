"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  BringToFront,
  Copy,
  ListFilter,
  Lock,
  MoreHorizontal,
  Plus,
  SendToBack,
  Trash2,
  Unlock,
} from "lucide-react";
import {
  getCompactor,
  GridLayout,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import { useEditorStore } from "@/store/editor-store";
import { ChartRenderer } from "@/components/charts/chart-renderer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ReportWidget, WidgetFilter } from "@/types";

const fixedGridCompactor = getCompactor(null, false, true);
const gridConfig = {
  cols: 12,
  rowHeight: 42,
  margin: [12, 12] as const,
  containerPadding: [12, 12] as const,
};
const canvasWidth = 1120;
const snapThreshold = 0.75;
const resizeHandles = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;

type SmartGuide = { orientation: "vertical" | "horizontal"; position: number };

export function ReportCanvas({ preview = false }: { preview?: boolean }) {
  const {
    report,
    activePageId,
    selectedWidgetId,
    mode,
    zoom,
    controlValues,
    interactionFilters,
    selectWidget,
    updateWidgetLayouts,
    duplicateWidget,
    removeWidget,
    toggleWidgetLocked,
    bringWidgetToFront,
    sendWidgetToBack,
    addWidget,
    setInteractionFilter,
  } = useEditorStore();
  const [smartGuides, setSmartGuides] = useState<SmartGuide[]>([]);
  const page =
    report.pages.find((item) => item.id === activePageId) ?? report.pages[0];
  const layouts = useMemo(
    () =>
      page.widgets.map((widget) => ({
        i: widget.id,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        minW: 2,
        minH: 2,
        static: widget.locked,
        isDraggable: !widget.locked,
        isResizable: !widget.locked,
      })),
    [page.widgets],
  );
  const activeInteractionFilters = useMemo(
    () =>
      Object.entries(interactionFilters)
        .map(([sourceWidgetId, filter]) => {
          const source = page.widgets.find((widget) => widget.id === sourceWidgetId);
          if (!source) return undefined;
          return { sourceWidgetId, source, filter };
        })
        .filter((item): item is { sourceWidgetId: string; source: ReportWidget; filter: WidgetFilter } => Boolean(item)),
    [interactionFilters, page.widgets],
  );

  const clearInteractionFilters = () => {
    activeInteractionFilters.forEach(({ sourceWidgetId }) => setInteractionFilter(sourceWidgetId, undefined));
  };

  const setGuidesIfChanged = (nextGuides: SmartGuide[]) => {
    setSmartGuides((current) => {
      if (
        current.length === nextGuides.length &&
        current.every(
          (guide, index) =>
            guide.orientation === nextGuides[index]?.orientation &&
            guide.position === nextGuides[index]?.position,
        )
      ) {
        return current;
      }

      return nextGuides;
    });
  };

  const updateSmartGuides = (
    layout: Layout,
    _oldItem: LayoutItem | null,
    newItem: LayoutItem | null,
  ) => {
    if (mode !== "edit" || preview || !newItem) return;
    setGuidesIfChanged(findSmartGuides(layout, newItem));
  };

  const clearSmartGuides = () => setGuidesIfChanged([]);

  const commitLayout = (
    layout: Layout,
    _oldItem?: LayoutItem | null,
    newItem?: LayoutItem | null,
  ) => {
    if (mode !== "edit") return;
    const snappedLayout = newItem
      ? snapLayoutToGuides(layout, newItem)
      : layout;
    updateWidgetLayouts(
      snappedLayout.map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      })),
    );
    clearSmartGuides();
  };

  return (
    <main
      className={cn(
        "dh-workspace flex min-w-0 flex-1 overflow-auto",
        preview ? "p-4" : "p-8",
      )}
    >
      <div
        className={cn(
          "dh-canvas mx-auto min-h-[920px] w-[1120px] origin-top",
          preview ? "border-transparent shadow-none" : "border",
        )}
        style={{
          transform: `scale(${zoom})`,
          backgroundColor: report.theme.pageBackground,
          color: report.theme.text,
          backgroundImage:
            mode === "edit"
              ? "radial-gradient(circle, var(--dh-border) 1px, transparent 1px)"
              : undefined,
          backgroundSize: "24px 24px",
        }}
        onClick={() => {
          if (!preview) selectWidget(undefined);
        }}
      >
        {page.widgets.length === 0 ? (
          <EmptyCanvas onAddChart={() => addWidget("bar")} />
        ) : (
          <div className="relative min-h-[920px]">
            <SmartGuideOverlay guides={smartGuides} />
            {activeInteractionFilters.length ? (
              <CrossFilterBanner
                filters={activeInteractionFilters}
                onClear={clearInteractionFilters}
              />
            ) : null}
            <GridLayout
              className="min-h-[920px]"
              width={canvasWidth}
              layout={layouts}
              gridConfig={gridConfig}
              dragConfig={{
                enabled: mode === "edit",
                threshold: 10,
                handle: ".dh-widget-drag-handle",
                cancel: ".widget-no-drag, .widget-locked",
              }}
              resizeConfig={{
                enabled: mode === "edit",
                handles: resizeHandles,
              }}
              compactor={fixedGridCompactor}
              onDrag={updateSmartGuides}
              onDragStop={commitLayout}
              onResize={updateSmartGuides}
              onResizeStop={commitLayout}
            >
              {page.widgets.map((widget, index) => {
                const dataset = report.datasets.find(
                  (item) => item.id === widget.config.datasetId,
                );
                const selected =
                  !preview && selectedWidgetId === widget.id && mode === "edit";
                const globalFilters = [
                  ...(report.filters ?? []),
                  ...(page.filters ?? []),
                  ...filtersForWidget(widget, page.widgets, controlValues),
                  ...Object.entries(interactionFilters)
                    .filter(([sourceWidgetId]) => {
                      const source = page.widgets.find(
                        (item) => item.id === sourceWidgetId,
                      );
                      return (
                        sourceWidgetId !== widget.id &&
                        source?.config.datasetId === widget.config.datasetId
                      );
                    })
                    .map(([, filter]) => filter),
                ];
                const showTitle =
                  widget.style.showTitle ?? widget.type !== "image";
                const hasCanvasTitle =
                  showTitle &&
                  widget.style.title &&
                  !["scorecard", "kpi", "text"].includes(widget.type);
                return (
                  <section
                    key={widget.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (preview) return;
                      selectWidget(widget.id);
                    }}
                    className={cn(
                      "dh-widget group relative overflow-hidden transition-shadow hover:shadow-md",
                      preview ? "border-transparent shadow-none" : "border",
                      selected && "dh-widget-selected",
                    )}
                    style={{
                      background: widget.style.background,
                      borderColor: widget.style.borderColor,
                      borderRadius: widget.style.borderRadius,
                      zIndex: index + 1,
                    }}
                  >
                    {selected ? (
                      <WidgetFloatingToolbar
                        widget={widget}
                        onDuplicate={() => duplicateWidget(widget.id)}
                        onRemove={() => removeWidget(widget.id)}
                        onToggleLocked={() => toggleWidgetLocked(widget.id)}
                        onBringToFront={() => bringWidgetToFront(widget.id)}
                        onSendToBack={() => sendWidgetToBack(widget.id)}
                      />
                    ) : null}
                    {hasCanvasTitle ? (
                      <div className="dh-widget-drag-handle h-8 cursor-move px-3 pt-2 text-sm font-semibold">
                        {widget.style.title}
                      </div>
                    ) : null}
                    {mode === "edit" && !preview && !widget.locked ? (
                      <div
                        className={cn(
                          "dh-widget-drag-handle absolute inset-x-2 top-1 z-10 h-3 cursor-move rounded-full opacity-0 transition-opacity group-hover:bg-muted-foreground/20 group-hover:opacity-100",
                          selected && "bg-primary/25 opacity-100",
                          hasCanvasTitle && "hidden",
                        )}
                        title="Mover widget"
                        aria-hidden
                      />
                    ) : null}
                    <div
                      className={cn(
                        "h-full",
                        hasCanvasTitle && "h-[calc(100%-2rem)]",
                      )}
                    >
                      <ChartRenderer
                        widget={widget}
                        dataset={dataset}
                        datasets={report.datasets}
                        dataModel={report.dataModel}
                        globalFilters={globalFilters}
                      />
                    </div>
                  </section>
                );
              })}
            </GridLayout>
          </div>
        )}
      </div>
    </main>
  );
}

function CrossFilterBanner({
  filters,
  onClear,
}: {
  filters: { source: ReportWidget; filter: WidgetFilter }[];
  onClear: () => void;
}) {
  const first = filters[0];
  const label = first ? `${first.source.style.title || widgetLabel(first.source.type)}: ${String(first.filter.value)}` : "";
  const extra = filters.length > 1 ? ` +${filters.length - 1}` : "";

  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-md border border-primary/25 bg-card/95 px-2.5 py-1.5 text-xs shadow-md">
      <ListFilter className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="truncate text-muted-foreground">
        Filtro activo: <span className="font-medium text-foreground">{label}</span>{extra}
      </span>
      <Button variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-xs" onClick={onClear}>
        Ver total
      </Button>
    </div>
  );
}

function widgetLabel(type: ReportWidget["type"]) {
  const labels: Record<ReportWidget["type"], string> = {
    bar: "Barra",
    horizontal_bar: "Barra horizontal",
    stacked_bar: "Barra apilada",
    line: "Línea",
    multi_line: "Multi línea",
    pie: "Torta",
    donut: "Dona",
    area: "Área",
    combo: "Combo",
    scatter: "Dispersión",
    table: "Tabla",
    pivot_table: "Tabla dinámica",
    kpi: "KPI",
    scorecard: "Tarjeta",
    text: "Texto",
    image: "Imagen",
    control_text: "Control de texto",
    control_date: "Control de fecha",
    control_select: "Selector",
  };
  return labels[type];
}

function filtersForWidget(
  widget: ReportWidget,
  widgets: ReportWidget[],
  controlValues: Record<string, string | [string, string] | undefined>,
): WidgetFilter[] {
  if (widget.type.startsWith("control") || !widget.config.datasetId) return [];

  return widgets.flatMap<WidgetFilter>((control) => {
    if (!control.type.startsWith("control")) return [];
    if (
      control.config.datasetId !== widget.config.datasetId ||
      !control.config.dimension
    )
      return [];
    const value = controlValues[control.id];
    if (!value) return [];

    if (control.type === "control_date") {
      if (!Array.isArray(value) || !value[0] || !value[1]) return [];
      return [{ column: control.config.dimension, operator: "between", value }];
    }

    if (Array.isArray(value) || String(value).trim() === "") return [];
    return [
      {
        column: control.config.dimension,
        operator: control.type === "control_select" ? "equals" : "contains",
        value,
      },
    ];
  });
}

function EmptyCanvas({ onAddChart }: { onAddChart: () => void }) {
  return (
    <div className="m-8 flex h-full min-h-[400px] flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <BarChart3 className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Canvas vacío</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Hacé click en &quot;Añadir un gráfico&quot; para empezar
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={(event) => {
          event.stopPropagation();
          onAddChart();
        }}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Añadir gráfico
      </Button>
    </div>
  );
}

function snapLayoutToGuides(layout: Layout, activeItem: LayoutItem) {
  const snap = findSnap(layout, activeItem);
  if (!snap) return layout;

  return layout.map((item) => {
    if (item.i !== activeItem.i) return item;

    return {
      ...item,
      x: Math.max(0, Math.min(gridConfig.cols - item.w, snap.x ?? item.x)),
      y: Math.max(0, snap.y ?? item.y),
    };
  });
}

function findSmartGuides(layout: Layout, activeItem: LayoutItem): SmartGuide[] {
  const snap = findSnap(layout, activeItem);
  const guides: SmartGuide[] = [];

  if (snap?.verticalGuide !== undefined) {
    guides.push({
      orientation: "vertical",
      position: gridXToPixels(snap.verticalGuide),
    });
  }

  if (snap?.horizontalGuide !== undefined) {
    guides.push({
      orientation: "horizontal",
      position: gridYToPixels(snap.horizontalGuide),
    });
  }

  return guides;
}

function findSnap(layout: Layout, activeItem: LayoutItem) {
  const others = layout.filter((item) => item.i !== activeItem.i);
  let bestX: { distance: number; x: number; guide: number } | undefined;
  let bestY: { distance: number; y: number; guide: number } | undefined;

  const activeXAnchors = [
    { value: activeItem.x, offset: 0 },
    { value: activeItem.x + activeItem.w / 2, offset: activeItem.w / 2 },
    { value: activeItem.x + activeItem.w, offset: activeItem.w },
  ];
  const activeYAnchors = [
    { value: activeItem.y, offset: 0 },
    { value: activeItem.y + activeItem.h / 2, offset: activeItem.h / 2 },
    { value: activeItem.y + activeItem.h, offset: activeItem.h },
  ];

  for (const item of others) {
    const targetXAnchors = [item.x, item.x + item.w / 2, item.x + item.w];
    const targetYAnchors = [item.y, item.y + item.h / 2, item.y + item.h];

    for (const activeAnchor of activeXAnchors) {
      for (const target of targetXAnchors) {
        const distance = Math.abs(activeAnchor.value - target);
        if (
          distance <= snapThreshold &&
          (!bestX || distance < bestX.distance)
        ) {
          bestX = { distance, x: target - activeAnchor.offset, guide: target };
        }
      }
    }

    for (const activeAnchor of activeYAnchors) {
      for (const target of targetYAnchors) {
        const distance = Math.abs(activeAnchor.value - target);
        if (
          distance <= snapThreshold &&
          (!bestY || distance < bestY.distance)
        ) {
          bestY = { distance, y: target - activeAnchor.offset, guide: target };
        }
      }
    }
  }

  if (!bestX && !bestY) return undefined;
  return {
    x: bestX?.x,
    y: bestY?.y,
    verticalGuide: bestX?.guide,
    horizontalGuide: bestY?.guide,
  };
}

function gridXToPixels(value: number) {
  const [marginX] = gridConfig.margin;
  const [paddingX] = gridConfig.containerPadding;
  const columnWidth =
    (canvasWidth - paddingX * 2 - marginX * (gridConfig.cols - 1)) /
    gridConfig.cols;
  return paddingX + value * (columnWidth + marginX);
}

function gridYToPixels(value: number) {
  const [, marginY] = gridConfig.margin;
  const [, paddingY] = gridConfig.containerPadding;
  return paddingY + value * (gridConfig.rowHeight + marginY);
}

function SmartGuideOverlay({ guides }: { guides: SmartGuide[] }) {
  if (guides.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {guides.map((guide) => (
        <div
          key={`${guide.orientation}-${guide.position}`}
          className="absolute bg-primary/70 shadow-[0_0_0_1px_rgba(255,255,255,0.75)]"
          style={
            guide.orientation === "vertical"
              ? { left: guide.position, top: 0, width: 1, height: "100%" }
              : { left: 0, top: guide.position, width: "100%", height: 1 }
          }
        />
      ))}
    </div>
  );
}

function WidgetFloatingToolbar({
  widget,
  onDuplicate,
  onRemove,
  onToggleLocked,
  onBringToFront,
  onSendToBack,
}: {
  widget: ReportWidget;
  onDuplicate: () => void;
  onRemove: () => void;
  onToggleLocked: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}) {
  const stopAndRun = (
    event: { stopPropagation: () => void },
    action: () => void,
  ) => {
    event.stopPropagation();
    action();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            title="Acciones del widget"
            aria-label="Acciones del widget"
            variant="outline"
            size="icon-sm"
            className="widget-no-drag absolute right-2 top-2 z-20 bg-card/95 opacity-0 shadow-md transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={(event) => stopAndRun(event, onDuplicate)}>
            <Copy className="h-4 w-4" />
            Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => stopAndRun(event, onToggleLocked)}
          >
            {widget.locked ? (
              <Unlock className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {widget.locked ? "Desbloquear" : "Bloquear"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => stopAndRun(event, onBringToFront)}
          >
            <BringToFront className="h-4 w-4" />
            Traer al frente
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => stopAndRun(event, onSendToBack)}
          >
            <SendToBack className="h-4 w-4" />
            Enviar atras
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={(event) => stopAndRun(event, onRemove)}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
