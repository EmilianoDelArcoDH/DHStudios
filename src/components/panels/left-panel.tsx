"use client";

import { Database, FileText, Layers, PanelLeftClose, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DatasourceUploader } from "@/components/datasources/datasource-uploader";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";

export function LeftPanel({ onCollapse }: { onCollapse?: () => void }) {
  const { report, activePageId, selectPage, addPage, removeDataset } = useEditorStore();

  const confirmRemoveDataset = (datasetId: string, datasetName: string) => {
    const confirmed = window.confirm(`Eliminar "${datasetName}"? Los widgets que usen este dataset quedaran sin fuente seleccionada.`);
    if (confirmed) removeDataset(datasetId);
  };

  return (
    <aside className="dh-panel flex h-full min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r">
      <ScrollArea className="min-h-0 flex-1 overscroll-contain">
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase text-[var(--dh-gray-700)]">Paginas</h2>
            <div className="flex items-center gap-1">
              {onCollapse ? (
                <Button title="Ocultar panel izquierdo" aria-label="Ocultar panel izquierdo" variant="ghost" size="icon" className="h-7 w-7" onClick={onCollapse}>
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              ) : null}
              <Button title="Agregar pagina" aria-label="Agregar pagina" variant="ghost" size="icon" className="h-7 w-7" onClick={addPage}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            {report.pages.map((page) => (
              <button
                key={page.id}
                onClick={() => selectPage(page.id)}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-[var(--dh-gray-900)] hover:bg-white", activePageId === page.id && "bg-white shadow-sm ring-1 ring-[var(--dh-border)]")}
              >
                <FileText className="h-4 w-4 text-[var(--dh-gray-700)]" />
                {page.name}
                <Badge variant="secondary" className="ml-auto">{page.widgets.length}</Badge>
              </button>
            ))}
          </div>
          <Separator className="my-4" />
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-[var(--dh-gray-700)]"><Database className="h-4 w-4" />Fuentes</h2>
          <div className="space-y-2">
            {report.datasets.map((dataset) => (
              <div key={dataset.id} className="rounded-md border border-[var(--dh-border)] bg-white p-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium" title={dataset.name}>{dataset.name}</div>
                    <div className="text-xs text-[var(--dh-gray-700)]">{dataset.rows.length} filas - {dataset.columns.length} columnas</div>
                    <div className="text-[11px] text-[var(--dh-gray-700)]">{formatDatasetDate(dataset.createdAt)}</div>
                  </div>
                  <Button
                    title="Eliminar dataset"
                    aria-label={`Eliminar ${dataset.name}`}
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => confirmRemoveDataset(dataset.id, dataset.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3"><DatasourceUploader /></div>
          <Separator className="my-4" />
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-[var(--dh-gray-700)]"><Layers className="h-4 w-4" />Componentes</h2>
          <p className="text-xs text-[var(--dh-gray-700)]">Selecciona un widget en el canvas para configurar datos y estilo.</p>
        </div>
      </ScrollArea>
    </aside>
  );
}

function formatDatasetDate(value?: string) {
  if (!value) return "Sin fecha de carga";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha de carga";
  return `Cargado ${date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}`;
}
