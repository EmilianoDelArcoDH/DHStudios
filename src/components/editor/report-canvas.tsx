"use client";

import { useMemo, useState } from "react";
import { BarChart3, BringToFront, Copy, Lock, MoreHorizontal, Plus, SendToBack, Trash2, Unlock } from "lucide-react";
import { getCompactor, GridLayout, type Layout, type LayoutItem } from "react-grid-layout";
import { useEditorStore } from "@/store/editor-store";
import { ChartRenderer } from "@/components/charts/chart-renderer";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ReportWidget, WidgetFilter } from "@/types";

const fixedGridCompactor = getCompactor(null, false, true);
const gridConfig = { cols: 12, rowHeight: 42, margin: [12, 12] as const, containerPadding: [12, 12] as const };
const canvasWidth = 1120;
const snapThreshold = 0.75;

type SmartGuide = { orientation: "vertical" | "horizontal"; position: number };

export function ReportCanvas({ preview = false }: { preview?: boolean }) {
  const {
    report,
    activePageId,
    selectedWidgetId,
    mode,
    zoom,
    controlValues,
    selectWidget,
    updateWidgetLayouts,
    duplicateWidget,
    removeWidget,
    toggleWidgetLocked,
    bringWidgetToFront,
    sendWidgetToBack,
    addWidget,
  } = useEditorStore();
  const [smartGuides, setSmartGuides] = useState<SmartGuide[]>([]);
  const page = report.pages.find((item) => item.id === activePageId) ?? report.pages[0];
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

  const setGuidesIfChanged = (nextGuides: SmartGuide[]) => {
    setSmartGuides((current) => {
      if (
        current.length === nextGuides.length &&
        current.every((guide, index) => guide.orientation === nextGuides[index]?.orientation && guide.position === nextGuides[index]?.position)
      ) {
        return current;
      }

      return nextGuides;
    });
  };

  const updateSmartGuides = (layout: Layout, _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
    if (mode !== "edit" || preview || !newItem) return;
    setGuidesIfChanged(findSmartGuides(layout, newItem));
  };

  const clearSmartGuides = () => setGuidesIfChanged([]);

  const commitLayout = (layout: Layout, _oldItem?: LayoutItem | null, newItem?: LayoutItem | null) => {
    if (mode !== "edit") return;
    const snappedLayout = newItem ? snapLayoutToGuides(layout, newItem) : layout;
    updateWidgetLayouts(snappedLayout.map((item) => ({ i: item.i, x: item.x, y: item.y, w: item.w, h: item.h })));
    clearSmartGuides();
  };

  return (
    <main className={cn("dh-workspace flex min-w-0 flex-1 overflow-auto", preview ? "p-4" : "p-8")}>
      <div
        className={cn("dh-canvas mx-auto min-h-[920px] w-[1120px] origin-top", preview ? "border-transparent shadow-none" : "border")}
        style={{
          transform: `scale(${zoom})`,
          backgroundColor: report.theme.pageBackground,
          color: report.theme.text,
          backgroundImage: mode === "edit" ? "linear-gradient(var(--dh-gray-ui) 1px, transparent 1px), linear-gradient(90deg, var(--dh-gray-ui) 1px, transparent 1px)" : undefined,
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
          <GridLayout
            className="min-h-[920px]"
            width={canvasWidth}
            layout={layouts}
            gridConfig={gridConfig}
            dragConfig={{ enabled: mode === "edit", threshold: 10, handle: ".widget-drag-handle", cancel: ".widget-no-drag, .widget-locked" }}
            resizeConfig={{ enabled: mode === "edit", handles: ["se"] }}
            compactor={fixedGridCompactor}
            onDrag={updateSmartGuides}
            onDragStop={commitLayout}
            onResizeStop={commitLayout}
          >
            {page.widgets.map((widget, index) => {
              const dataset = report.datasets.find((item) => item.id === widget.config.datasetId);
              const selected = !preview && selectedWidgetId === widget.id && mode === "edit";
              const globalFilters = filtersForWidget(widget, page.widgets, controlValues);
              const showTitle = widget.style.showTitle ?? widget.type !== "image";
              const hasCanvasTitle = showTitle && widget.style.title && !["scorecard", "kpi", "text"].includes(widget.type);
              return (
                <section
                  key={widget.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (preview) return;
                    selectWidget(widget.id);
                  }}
                  className={cn("dh-widget relative overflow-hidden", preview ? "border-transparent shadow-none" : "border", selected && "ring-2 ring-primary")}
                  style={{ background: widget.style.background, borderColor: widget.style.borderColor, borderRadius: widget.style.borderRadius, zIndex: index + 1 }}
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
                  {mode === "edit" ? (
                    <div className={cn("widget-drag-handle flex h-5 items-center justify-center border-b border-[var(--dh-border)] bg-background/90 text-[10px] font-semibold text-muted-foreground", widget.locked ? "widget-locked cursor-default" : "cursor-grab active:cursor-grabbing", !selected && "opacity-0")}>
                      {widget.locked ? "bloqueado" : "mover"}
                    </div>
                  ) : null}
                  {hasCanvasTitle ? <div className="widget-no-drag h-8 px-3 pt-2 text-sm font-semibold">{widget.style.title}</div> : null}
                  <div className={cn("widget-no-drag h-full", mode === "edit" && "h-[calc(100%-1.25rem)]", hasCanvasTitle && "h-[calc(100%-2rem)]", mode === "edit" && hasCanvasTitle && "h-[calc(100%-3.25rem)]")}>
                      <ChartRenderer widget={widget} dataset={dataset} datasets={report.datasets} dataModel={report.dataModel} globalFilters={globalFilters} />
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

function filtersForWidget(widget: ReportWidget, widgets: ReportWidget[], controlValues: Record<string, string | [string, string] | undefined>): WidgetFilter[] {
  if (widget.type.startsWith("control") || !widget.config.datasetId) return [];

  return widgets.flatMap<WidgetFilter>((control) => {
    if (!control.type.startsWith("control")) return [];
    if (control.config.datasetId !== widget.config.datasetId || !control.config.dimension) return [];
    const value = controlValues[control.id];
    if (!value) return [];

    if (control.type === "control_date") {
      if (!Array.isArray(value) || !value[0] || !value[1]) return [];
      return [{ column: control.config.dimension, operator: "between", value }];
    }

    if (Array.isArray(value) || String(value).trim() === "") return [];
    return [{
      column: control.config.dimension,
      operator: control.type === "control_select" ? "equals" : "contains",
      value,
    }];
  });
}

function EmptyCanvas({ onAddChart }: { onAddChart: () => void }) {
  return (
    <div className="flex h-[720px] items-center justify-center px-8 text-center">
      <div className="max-w-sm rounded-md border border-dashed border-[var(--dh-border)] bg-background/85 p-6 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
          <BarChart3 className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold">Empeza tu informe</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Agrega un grafico al canvas y despues conectalo con una fuente de datos desde el panel de propiedades.
        </p>
        <Button
          className="mt-4"
          onClick={(event) => {
            event.stopPropagation();
            onAddChart();
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar primer grafico
        </Button>
      </div>
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
    guides.push({ orientation: "vertical", position: gridXToPixels(snap.verticalGuide) });
  }

  if (snap?.horizontalGuide !== undefined) {
    guides.push({ orientation: "horizontal", position: gridYToPixels(snap.horizontalGuide) });
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
        if (distance <= snapThreshold && (!bestX || distance < bestX.distance)) {
          bestX = { distance, x: target - activeAnchor.offset, guide: target };
        }
      }
    }

    for (const activeAnchor of activeYAnchors) {
      for (const target of targetYAnchors) {
        const distance = Math.abs(activeAnchor.value - target);
        if (distance <= snapThreshold && (!bestY || distance < bestY.distance)) {
          bestY = { distance, y: target - activeAnchor.offset, guide: target };
        }
      }
    }
  }

  if (!bestX && !bestY) return undefined;
  return { x: bestX?.x, y: bestY?.y, verticalGuide: bestX?.guide, horizontalGuide: bestY?.guide };
}

function gridXToPixels(value: number) {
  const [marginX] = gridConfig.margin;
  const [paddingX] = gridConfig.containerPadding;
  const columnWidth = (canvasWidth - paddingX * 2 - marginX * (gridConfig.cols - 1)) / gridConfig.cols;
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
  const stopAndRun = (event: { stopPropagation: () => void }, action: () => void) => {
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
            className="widget-no-drag absolute right-2 top-2 z-20 bg-card/95 shadow-md"
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
          <DropdownMenuItem onClick={(event) => stopAndRun(event, onToggleLocked)}>
            {widget.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {widget.locked ? "Desbloquear" : "Bloquear"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(event) => stopAndRun(event, onBringToFront)}>
            <BringToFront className="h-4 w-4" />
            Traer al frente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(event) => stopAndRun(event, onSendToBack)}>
            <SendToBack className="h-4 w-4" />
            Enviar atras
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={(event) => stopAndRun(event, onRemove)}>
            <Trash2 className="h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
