"use client";

import { useMemo } from "react";
import { GridLayout, noCompactor, type Layout } from "react-grid-layout";
import { useEditorStore } from "@/store/editor-store";
import { ChartRenderer } from "@/components/charts/chart-renderer";
import { cn } from "@/lib/utils";

export function ReportCanvas() {
  const { report, activePageId, selectedWidgetId, mode, zoom, selectWidget, updateWidgetLayouts } = useEditorStore();
  const page = report.pages.find((item) => item.id === activePageId) ?? report.pages[0];
  const layouts = useMemo(
    () => page.widgets.map((widget) => ({ i: widget.id, x: widget.x, y: widget.y, w: widget.w, h: widget.h, minW: 2, minH: 2 })),
    [page.widgets],
  );

  const commitLayout = (layout: Layout) => {
    if (mode !== "edit") return;
    updateWidgetLayouts(layout.map((item) => ({ i: item.i, x: item.x, y: item.y, w: item.w, h: item.h })));
  };

  return (
    <main className="dh-workspace flex min-w-0 flex-1 overflow-auto p-8">
      <div
        className="dh-canvas mx-auto min-h-[920px] w-[1120px] origin-top border"
        style={{
          transform: `scale(${zoom})`,
          backgroundColor: report.theme.pageBackground,
          color: report.theme.text,
          backgroundImage: mode === "edit" ? "linear-gradient(var(--dh-gray-ui) 1px, transparent 1px), linear-gradient(90deg, var(--dh-gray-ui) 1px, transparent 1px)" : undefined,
          backgroundSize: "24px 24px",
        }}
        onClick={() => selectWidget(undefined)}
      >
        {page.widgets.length === 0 ? (
          <div className="flex h-[720px] items-center justify-center text-sm text-[var(--dh-gray-700)]">Agregá gráficos, controles o texto desde la barra superior.</div>
        ) : (
          <GridLayout
            className="min-h-[920px]"
            width={1120}
            layout={layouts}
            gridConfig={{ cols: 12, rowHeight: 42, margin: [12, 12], containerPadding: [12, 12] }}
            dragConfig={{ enabled: mode === "edit", threshold: 3 }}
            resizeConfig={{ enabled: mode === "edit", handles: ["se"] }}
            compactor={noCompactor}
            onDragStop={commitLayout}
            onResizeStop={commitLayout}
          >
            {page.widgets.map((widget) => {
              const dataset = report.datasets.find((item) => item.id === widget.config.datasetId);
              return (
                <section
                  key={widget.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    selectWidget(widget.id);
                  }}
                  className={cn("dh-widget overflow-hidden border", selectedWidgetId === widget.id && mode === "edit" && "ring-2 ring-primary")}
                  style={{ background: widget.style.background, borderColor: widget.style.borderColor, borderRadius: widget.style.borderRadius }}
                >
                  {widget.style.title && !["scorecard", "kpi", "text"].includes(widget.type) ? <div className="h-8 px-3 pt-2 text-sm font-semibold">{widget.style.title}</div> : null}
                  <div className={cn("h-full", widget.style.title && !["scorecard", "kpi", "text"].includes(widget.type) && "h-[calc(100%-2rem)]")}>
                    <ChartRenderer widget={widget} dataset={dataset} />
                  </div>
                </section>
              );
            })}
          </GridLayout>
        )}
      </div>
    </main>
  );
}
