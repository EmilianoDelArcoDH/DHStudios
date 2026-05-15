"use client";

import { useState } from "react";
import { AreaChart, BarChart3, BringToFront, Copy, Database, FileText, Image as ImageIcon, Layers, LineChart, ListFilter, Lock, MoreHorizontal, PanelLeftClose, PieChart, Plus, ScatterChart, SendToBack, Table2, TextCursorInput, Trash2, Type, Unlock, Settings2 } from "lucide-react";
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
    <aside className="dh-panel flex h-full min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
        <h2 className="text-sm font-semibold">Navegacion</h2>
        {onCollapse ? (
          <Button title="Ocultar panel izquierdo" aria-label="Ocultar panel izquierdo" variant="ghost" size="icon" className="h-7 w-7" onClick={onCollapse}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="pages" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="m-3 grid grid-cols-2 rounded-md bg-[var(--dh-gray-ui)]">
          <TabsTrigger value="pages">Paginas</TabsTrigger>
          <TabsTrigger value="data">Datos</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="h-0 min-h-0 flex-1">
          <ScrollArea className="h-full overscroll-contain">
            <div className="space-y-3 p-3 pt-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Paginas</h3>
              <Button title="Agregar pagina" aria-label="Agregar pagina" variant="ghost" size="icon" className="h-7 w-7" onClick={addPage}>
                <Plus className="h-4 w-4" />
              </Button>
              </div>
              <div className="space-y-1">
                {report.pages.map((page) => (
                  <div
                    key={page.id}
                    className={cn("group flex items-center gap-1 rounded-md px-1 py-1 text-sm text-foreground hover:bg-card", activePageId === page.id && "bg-card shadow-sm ring-1 ring-[var(--dh-border)]")}
                  >
                    <button
                      type="button"
                      onClick={() => selectPage(page.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1 py-1 text-left"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
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
                        <span className="truncate">{page.name}</span>
                      )}
                      <Badge variant="secondary" className="ml-auto shrink-0">{page.widgets.length}</Badge>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            title="Acciones de pagina"
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
              <div className="space-y-2 rounded-md border border-[var(--dh-border)] bg-card p-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Layers className="h-4 w-4" />Capas</h3>
                  <Badge variant="outline">{layers.length}</Badge>
                </div>
                {layers.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">No hay componentes en esta pagina.</p>
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
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="data" className="h-0 min-h-0 flex-1">
          <ScrollArea className="h-full overscroll-contain">
            <div className="space-y-3 p-3 pt-0">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Database className="h-4 w-4" />Fuentes</h3>
              <div className="space-y-2">
                {report.datasets.map((dataset) => (
                  <div key={dataset.id} className="rounded-md border border-[var(--dh-border)] bg-card p-2">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium" title={dataset.name}>{dataset.name}</div>
                        <div className="text-xs text-muted-foreground">{dataset.rows.length} filas - {dataset.columns.length} columnas</div>
                        <div className="text-[11px] text-muted-foreground">{formatDatasetDate(dataset.createdAt)}</div>
                      </div>
                      <Button
                        title="Eliminar dataset"
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
              Vas a eliminar <span className="font-medium">{datasetToDelete?.name}</span>. Los widgets que usen esta fuente quedaran sin fuente seleccionada.
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
            <DialogTitle>Eliminar pagina</DialogTitle>
            <DialogDescription>
              Vas a eliminar <span className="font-medium">{pageToDelete?.name}</span> y todos sus componentes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPageToDelete(undefined)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmRemovePage}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar pagina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
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
    <div className={cn("rounded-md border border-transparent p-1", selected && "border-primary bg-primary/5")}>
      <button type="button" className="flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-background" onClick={onSelect}>
        {widgetIcon(widget.type)}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{label}</div>
          <div className="text-[11px] text-muted-foreground">{widgetLabel(widget.type)}</div>
        </div>
        {widget.locked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : null}
      </button>
      <div className="mt-1 flex items-center justify-end gap-1">
        <Button title={widget.locked ? "Desbloquear" : "Bloquear"} aria-label={widget.locked ? "Desbloquear" : "Bloquear"} variant="ghost" size="icon-xs" onClick={onToggleLocked}>
          {widget.locked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
        </Button>
        <Button title="Enviar atras" aria-label="Enviar atras" variant="ghost" size="icon-xs" onClick={onSendToBack} disabled={isBottom}>
          <SendToBack className="h-3 w-3" />
        </Button>
        <Button title="Traer al frente" aria-label="Traer al frente" variant="ghost" size="icon-xs" onClick={onBringToFront} disabled={isTop}>
          <BringToFront className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function widgetIcon(type: WidgetType) {
  const className = "h-4 w-4 shrink-0 text-muted-foreground";
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
    line: "Linea",
    multi_line: "Multi linea",
    pie: "Torta",
    donut: "Dona",
    area: "Area",
    combo: "Combo",
    scatter: "Dispersion",
    table: "Tabla",
    pivot_table: "Tabla dinamica",
    kpi: "KPI",
    scorecard: "Scorecard",
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
