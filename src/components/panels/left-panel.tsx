"use client";

import { useState } from "react";
import { AreaChart, BarChart3, BringToFront, Copy, FileText, Image as ImageIcon, LineChart, ListFilter, Lock, MoreHorizontal, PanelLeftClose, PieChart, Plus, ScatterChart, SendToBack, Table2, TextCursorInput, Trash2, Type, Unlock, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatasourceUploader } from "@/components/datasources/datasource-uploader";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";
import type { ReportWidget, WidgetType } from "@/types";

export function LeftPanel({ onCollapse, onManageDataset }: { onCollapse?: () => void; onManageDataset?: (datasetId: string) => void }) {
  const {
    report,
    activePageId,
    selectedWidgetId,
    selectPage,
    selectWidget,
    addPage,
    duplicatePage,
    updatePage,
    removePage,
    removeDataset,
    toggleWidgetLocked,
    bringWidgetToFront,
    sendWidgetToBack,
  } = useEditorStore();
  const [datasetToDelete, setDatasetToDelete] = useState<{ id: string; name: string } | undefined>();
  const [pageToDelete, setPageToDelete] = useState<{ id: string; name: string } | undefined>();
  const [renamingPageId, setRenamingPageId] = useState<string | undefined>();
  const activePage = report.pages.find((page) => page.id === activePageId) ?? report.pages[0];
  const layers = [...(activePage?.widgets ?? [])].reverse();

  const confirmRemoveDataset = () => {
    if (!datasetToDelete) return;
    removeDataset(datasetToDelete.id);
    setDatasetToDelete(undefined);
  };

  const confirmRemovePage = () => {
    if (!pageToDelete) return;
    removePage(pageToDelete.id);
    setPageToDelete(undefined);
  };

  return (
    <aside className="group/left-panel relative flex h-full min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r bg-card">
      {onCollapse ? (
        <div className="pointer-events-none absolute right-1 top-1 z-20 opacity-0 transition-opacity group-hover/left-panel:opacity-100 focus-within:opacity-100">
          <Button
            title="Ocultar panel izquierdo"
            aria-label="Ocultar panel izquierdo"
            variant="ghost"
            size="icon"
            className="pointer-events-auto h-7 w-7 bg-card/90"
            onClick={onCollapse}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      <Tabs defaultValue="pages" className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className="grid h-9 w-full grid-cols-2 rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="pages"
            className="h-full rounded-none border-b-2 border-transparent text-xs font-medium focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none data-active:border-primary data-active:bg-transparent data-active:text-primary data-active:shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            Páginas
          </TabsTrigger>
          <TabsTrigger
            value="data"
            className="h-full rounded-none border-b-2 border-transparent text-xs font-medium focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none data-active:border-primary data-active:bg-transparent data-active:text-primary data-active:shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            Datos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="h-0 min-h-0 flex-1">
          <ScrollArea className="h-full overscroll-contain">
            <div className="space-y-5 p-2 pt-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Páginas</h3>
                <Button title="Agregar página" aria-label="Agregar página" variant="ghost" size="icon-xs" className="h-6 w-6 rounded-full" onClick={addPage}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="space-y-1.5">
                {report.pages.map((page) => (
                  <div
                    key={page.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-md px-1 py-1 text-sm text-foreground transition-colors hover:bg-muted",
                      activePageId === page.id && "bg-primary/10 ring-1 ring-primary/20",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectPage(page.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left"
                    >
                      <PageThumb active={activePageId === page.id} />
                      {renamingPageId === page.id ? (
                        <Input
                          autoFocus
                          value={page.name}
                          className="h-7 min-w-0 px-2 text-sm"
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => updatePage(page.id, { name: event.target.value })}
                          onBlur={() => setRenamingPageId(undefined)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === "Escape") setRenamingPageId(undefined);
                          }}
                        />
                      ) : (
                        <span className={cn("truncate text-sm", activePageId === page.id ? "font-medium text-primary" : "text-foreground")}>{page.name}</span>
                      )}
                      <Badge variant="secondary" className="ml-auto h-5 shrink-0 rounded-full bg-card px-1.5 text-[11px] text-muted-foreground">{page.widgets.length}</Badge>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            title="Acciones de página"
                            aria-label={`Acciones de ${page.name}`}
                            variant="ghost"
                            size="icon-xs"
                            className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                            onClick={(event) => event.stopPropagation()}
                          />
                        }
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => setRenamingPageId(page.id)}>
                            <FileText className="h-4 w-4" />
                            Renombrar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicatePage(page.id)}>
                            <Copy className="h-4 w-4" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={report.pages.length <= 1}
                            onClick={() => setPageToDelete({ id: page.id, name: page.name })}
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Capas</h3>
                  <span className="text-xs text-muted-foreground">{layers.length}</span>
                </div>
                {layers.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">No hay componentes en esta página.</p>
                ) : null}
                <div className="space-y-1">
                  {layers.map((widget, index) => (
                    <LayerRow
                      key={widget.id}
                      widget={widget}
                      selected={widget.id === selectedWidgetId}
                      isTop={index === 0}
                      isBottom={index === layers.length - 1}
                      onSelect={() => selectWidget(widget.id)}
                      onToggleLocked={() => toggleWidgetLocked(widget.id)}
                      onBringToFront={() => bringWidgetToFront(widget.id)}
                      onSendToBack={() => sendWidgetToBack(widget.id)}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fuentes de datos</h3>
                </div>
                <div className="space-y-2">
                  {report.datasets.map((dataset) => (
                    <DatasetMiniCard
                      key={dataset.id}
                      name={dataset.name}
                      rows={dataset.rows.length}
                      columns={dataset.columns.length}
                      onClick={() => onManageDataset?.(dataset.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="data" className="h-0 min-h-0 flex-1">
          <ScrollArea className="h-full overscroll-contain">
            <div className="space-y-3 p-3 pt-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fuentes de datos</h3>
              <div className="space-y-2">
                {report.datasets.map((dataset) => (
                  <div key={dataset.id} className="rounded-md border border-border bg-card p-2.5 shadow-sm">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground" title={dataset.name}>{dataset.name}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{dataset.rows.length} filas · {dataset.columns.length} columnas</div>
                        <div className="text-[11px] text-muted-foreground">{formatDatasetDate(dataset.createdAt)}</div>
                      </div>
                      <Button
                        title="Eliminar fuente"
                        aria-label={`Eliminar ${dataset.name}`}
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDatasetToDelete({ id: dataset.id, name: dataset.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => onManageDataset?.(dataset.id)}>
                      <Settings2 className="mr-2 h-4 w-4" />
                      Gestionar
                    </Button>
                  </div>
                ))}
              </div>
              <DatasourceUploader />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(datasetToDelete)} onOpenChange={(open) => {
        if (!open) setDatasetToDelete(undefined);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar fuente de datos</DialogTitle>
            <DialogDescription>
              Vas a eliminar <span className="font-medium">{datasetToDelete?.name}</span>. Los widgets que usen esta fuente quedarán sin fuente seleccionada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDatasetToDelete(undefined)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmRemoveDataset}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar fuente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pageToDelete)} onOpenChange={(open) => {
        if (!open) setPageToDelete(undefined);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar página</DialogTitle>
            <DialogDescription>
              Vas a eliminar <span className="font-medium">{pageToDelete?.name}</span> y todos sus componentes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPageToDelete(undefined)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmRemovePage}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar página
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

function PageThumb({ active }: { active: boolean }) {
  return (
    <span className="grid h-7 w-10 shrink-0 grid-cols-2 gap-0.5 rounded-sm border border-border bg-muted p-0.5">
      <span className={cn("rounded-[1px] bg-muted-foreground/25", active && "bg-primary/35")} />
      <span className="rounded-[1px] bg-muted-foreground/25" />
      <span className="rounded-[1px] bg-muted-foreground/25" />
      <span className={cn("rounded-[1px] bg-muted-foreground/25", active && "bg-primary/25")} />
    </span>
  );
}

function LayerRow({
  widget,
  selected,
  isTop,
  isBottom,
  onSelect,
  onToggleLocked,
  onBringToFront,
  onSendToBack,
}: {
  widget: ReportWidget;
  selected: boolean;
  isTop: boolean;
  isBottom: boolean;
  onSelect: () => void;
  onToggleLocked: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}) {
  const label = widget.style.title || widgetLabel(widget.type);

  return (
    <div className={cn(
      "group relative rounded-md border border-transparent transition-colors hover:bg-muted",
      selected && "bg-primary/10",
    )}>
      <button type="button" className="flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left" onClick={onSelect}>
        {widgetIcon(widget.type)}
        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-xs font-medium leading-4 text-foreground", selected && "text-primary")}>{label}</div>
          <div className="text-[10px] leading-3 text-muted-foreground">{widgetLabel(widget.type)}</div>
        </div>
        {widget.locked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : null}
      </button>
      <div className="absolute right-1 top-1 hidden items-center gap-0.5 bg-card group-hover:flex">
        <Button title={widget.locked ? "Desbloquear" : "Bloquear"} aria-label={widget.locked ? "Desbloquear" : "Bloquear"} variant="ghost" size="icon-xs" onClick={onToggleLocked}>
          {widget.locked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
        </Button>
        <Button title="Enviar atrás" aria-label="Enviar atrás" variant="ghost" size="icon-xs" onClick={onSendToBack} disabled={isBottom}>
          <SendToBack className="h-3 w-3" />
        </Button>
        <Button title="Traer al frente" aria-label="Traer al frente" variant="ghost" size="icon-xs" onClick={onBringToFront} disabled={isTop}>
          <BringToFront className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function DatasetMiniCard({ name, rows, columns, onClick }: { name: string; rows: number; columns: number; onClick?: () => void }) {
  return (
    <button
      type="button"
      className="w-full rounded-md border border-border bg-card p-2 text-left shadow-sm transition-colors hover:bg-muted"
      onClick={onClick}
    >
      <div className="truncate text-xs font-semibold text-foreground" title={name}>{name}</div>
      <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
        {rows.toLocaleString("es-AR")} filas · {columns} columnas
      </div>
    </button>
  );
}

function widgetIcon(type: WidgetType) {
  const className = "h-3.5 w-3.5 shrink-0 text-muted-foreground";
  if (type === "pie" || type === "donut") return <PieChart className={className} />;
  if (type === "line" || type === "multi_line") return <LineChart className={className} />;
  if (type === "area") return <AreaChart className={className} />;
  if (type === "scatter") return <ScatterChart className={className} />;
  if (type === "table" || type === "pivot_table") return <Table2 className={className} />;
  if (type === "text") return <Type className={className} />;
  if (type === "image") return <ImageIcon className={className} />;
  if (type.startsWith("control")) return <ListFilter className={className} />;
  if (type === "kpi" || type === "scorecard") return <TextCursorInput className={className} />;
  return <BarChart3 className={className} />;
}

function widgetLabel(type: WidgetType) {
  const labels: Record<WidgetType, string> = {
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

function formatDatasetDate(value?: string) {
  if (!value) return "Sin fecha de carga";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha de carga";
  return `Cargado ${date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}`;
}


