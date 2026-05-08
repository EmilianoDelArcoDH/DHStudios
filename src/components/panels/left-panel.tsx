"use client";

import { Database, FileText, Layers, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DatasourceUploader } from "@/components/datasources/datasource-uploader";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";

export function LeftPanel() {
  const { report, activePageId, selectPage, addPage } = useEditorStore();

  return (
    <aside className="dh-panel w-64 shrink-0 border-r">
      <ScrollArea className="h-full">
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase text-[var(--dh-gray-700)]">Páginas</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addPage}><Plus className="h-4 w-4" /></Button>
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
                <div className="text-sm font-medium">{dataset.name}</div>
                <div className="text-xs text-[var(--dh-gray-700)]">{dataset.rows.length} filas · {dataset.columns.length} columnas</div>
              </div>
            ))}
          </div>
          <div className="mt-3"><DatasourceUploader /></div>
          <Separator className="my-4" />
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-[var(--dh-gray-700)]"><Layers className="h-4 w-4" />Componentes</h2>
          <p className="text-xs text-[var(--dh-gray-700)]">Seleccioná un widget en el canvas para configurar datos y estilo.</p>
        </div>
      </ScrollArea>
    </aside>
  );
}
