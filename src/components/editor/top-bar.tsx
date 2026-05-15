"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, Eye, FileJson, MoreHorizontal, Redo2, Save, Share2, Undo2 } from "lucide-react";
import { EditorSettingsSheet } from "@/components/editor/editor-settings-sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorStore } from "@/store/editor-store";
import { exportReport, importReport } from "@/lib/report-io";
import { reportService } from "@/services/report-service";

const APPEARANCE_STORAGE_KEY = "dhstudios.appearance";

export function TopBar({ readonly = false, onPreview }: { readonly?: boolean; onPreview?: () => void }) {
  const {
    report,
    mode,
    loading,
    selectedWidgetId,
    updateReport,
    setMode,
    undo,
    redo,
    autosave,
    setReport,
    addPage,
    addWidget,
    bringWidgetToFront,
    sendWidgetToBack,
    toggleWidgetLocked,
  } = useEditorStore();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "sharing" | "copied" | "error">("idle");
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(APPEARANCE_STORAGE_KEY) === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (shareState !== "copied" && shareState !== "error") return;

    const timeout = window.setTimeout(() => setShareState("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [shareState]);

  useEffect(() => {
    if (readonly) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }

      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }

      if (key === "s") {
        event.preventDefault();
        void autosave();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [autosave, readonly, redo, undo]);

  const handleDarkModeChange = (checked: boolean) => {
    setDarkMode(checked);
    document.documentElement.classList.toggle("dark", checked);
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, checked ? "dark" : "light");
  };

  const download = () => {
    const blob = new Blob([exportReport(report)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${report.name || report.projectId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file?: File) => {
    if (!file) return;
    const imported = importReport(await file.text());
    setReport(imported);
    await reportService.saveReport(imported);
    if (imported.projectId !== report.projectId) {
      window.location.href = `/editor/${imported.projectId}`;
    }
  };

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/view/${report.projectId}` : "";

  const openShareDialog = async () => {
    if (readonly || shareState === "sharing") return;

    setShareOpen(true);
    try {
      setShareState("sharing");
      const publishedReport = { ...report, isPublic: true, updatedAt: new Date().toISOString() };
      updateReport({ isPublic: true });
      await reportService.saveReport(publishedReport);
      setShareState("idle");
    } catch {
      setShareState("error");
    }
  };

  const copyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setShareState("copied");
    } catch {
      setShareState("error");
    }
  };

  return (
    <>
      <header className="dh-toolbar flex h-16 shrink-0 items-center gap-3 border-b px-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <Input
              value={report.name}
              onChange={(event) => updateReport({ name: event.target.value })}
              disabled={readonly}
              className="h-6 w-full max-w-80 border-transparent bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
            />
            <span className="hidden truncate font-mono text-[11px] text-muted-foreground lg:inline">{report.projectId}</span>
          </div>
          {!readonly ? (
            <TopMenu
              onSave={() => void autosave()}
              onDownload={download}
              onUpload={upload}
              onShare={() => void openShareDialog()}
              onUndo={undo}
              onRedo={redo}
              onEdit={() => setMode("edit")}
              onPreview={onPreview}
              onAddPage={addPage}
              onAddWidget={addWidget}
              selectedWidgetId={selectedWidgetId}
              onBringToFront={() => selectedWidgetId ? bringWidgetToFront(selectedWidgetId) : undefined}
              onSendToBack={() => selectedWidgetId ? sendWidgetToBack(selectedWidgetId) : undefined}
              onToggleLocked={() => selectedWidgetId ? toggleWidgetLocked(selectedWidgetId) : undefined}
            />
          ) : null}
        </div>

        {!readonly ? (
          <div className="hidden items-center rounded-md border border-[var(--dh-border)] bg-background p-0.5 md:flex">
            <ModeButton active={mode === "edit"} onClick={() => setMode("edit")}>Editar</ModeButton>
            <ModeButton active={false} onClick={() => onPreview?.()}>Preview</ModeButton>
          </div>
        ) : (
          <div className="hidden items-center rounded-md border border-[var(--dh-border)] bg-background p-0.5 md:flex">
            <ModeButton active disabled onClick={() => undefined}>Ver</ModeButton>
          </div>
        )}

        {!readonly ? (
          <div className="hidden items-center gap-1 rounded-md border border-[var(--dh-border)] bg-background px-1 py-0.5 lg:flex">
            <ToolButton label="Deshacer" shortcut="Ctrl Z" onClick={undo}><Undo2 className="h-4 w-4" /></ToolButton>
            <ToolButton label="Rehacer" shortcut="Ctrl Y" onClick={redo}><Redo2 className="h-4 w-4" /></ToolButton>
            <div className="mx-1 h-5 w-px bg-border" />
            <TooltipButton label="Guardar" shortcut="Ctrl S">
              <Button variant="ghost" size="sm" onClick={() => void autosave()}>
                <Save className="mr-2 h-4 w-4" />
                Guardar
              </Button>
            </TooltipButton>
          </div>
        ) : null}

        <div className="hidden min-w-20 items-center gap-1 text-xs text-muted-foreground sm:flex">
          <span className={loading ? "h-2 w-2 rounded-full bg-amber-500" : "h-2 w-2 rounded-full bg-emerald-500"} />
          {loading ? "Guardando" : "Guardado"}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => void openShareDialog()}
            disabled={shareState === "sharing"}
          >
            <Share2 className="mr-2 h-4 w-4" />
            {shareState === "sharing" ? "Preparando..." : "Compartir"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" title="Mas acciones" aria-label="Mas acciones" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                {!readonly ? (
                  <DropdownMenuItem onClick={() => void autosave()}>
                    <Save className="h-4 w-4" />
                    Guardar ahora
                  </DropdownMenuItem>
                ) : null}
                {!readonly && onPreview ? (
                  <DropdownMenuItem className="md:hidden" onClick={onPreview}>
                    <Eye className="h-4 w-4" />
                    Preview
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={download}>
                  <Download className="h-4 w-4" />
                  Descargar
                </DropdownMenuItem>
                {!readonly ? (
                  <DropdownMenuItem>
                    <label className="flex w-full cursor-pointer items-center gap-1.5">
                      <FileJson className="h-4 w-4" />
                      Importar
                      <input type="file" accept="application/json" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
                    </label>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {!readonly ? <EditorSettingsSheet darkMode={darkMode} onDarkModeChange={handleDarkModeChange} /> : null}
        </div>
      </header>

      <Dialog open={shareOpen} onOpenChange={(open) => {
        setShareOpen(open);
        if (!open) setShareState("idle");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir reporte</DialogTitle>
            <DialogDescription>
              Este link abre la vista pública del reporte, igual a la presentación que ve el usuario final.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              {shareState === "sharing"
                ? "Publicando reporte..."
                : shareState === "error"
                  ? "No se pudo preparar o copiar el link."
                  : "El reporte está publicado y listo para compartir."}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Link público</label>
              <Input value={publicUrl} readOnly className="font-mono text-xs" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>Cerrar</Button>
            <Button onClick={() => void copyPublicUrl()} disabled={shareState === "sharing"}>
              {shareState === "copied" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {shareState === "copied" ? "Copiado" : "Copiar link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TopMenu({
  onSave,
  onDownload,
  onUpload,
  onShare,
  onUndo,
  onRedo,
  onEdit,
  onPreview,
  onAddPage,
  onAddWidget,
  selectedWidgetId,
  onBringToFront,
  onSendToBack,
  onToggleLocked,
}: {
  onSave: () => void;
  onDownload: () => void;
  onUpload: (file?: File) => void | Promise<void>;
  onShare: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onEdit: () => void;
  onPreview?: () => void;
  onAddPage: () => void;
  onAddWidget: ReturnType<typeof useEditorStore.getState>["addWidget"];
  selectedWidgetId?: string;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onToggleLocked: () => void;
}) {
  const hasSelection = Boolean(selectedWidgetId);

  return (
    <nav className="flex items-center gap-1 text-sm">
      <MenuRoot label="Archivo">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Informe</DropdownMenuLabel>
          <DropdownMenuItem onClick={onSave}>Guardar</DropdownMenuItem>
          <DropdownMenuItem onClick={onShare}>Compartir</DropdownMenuItem>
          <DropdownMenuItem onClick={onDownload}>Descargar</DropdownMenuItem>
          <DropdownMenuItem>
            <label className="flex w-full cursor-pointer items-center gap-1.5">
              Importar
              <input type="file" accept="application/json" className="hidden" onChange={(event) => void onUpload(event.target.files?.[0])} />
            </label>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </MenuRoot>

      <MenuRoot label="Editar">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onUndo}>Deshacer <span className="ml-auto font-mono text-xs text-muted-foreground">Ctrl Z</span></DropdownMenuItem>
          <DropdownMenuItem onClick={onRedo}>Rehacer <span className="ml-auto font-mono text-xs text-muted-foreground">Ctrl Y</span></DropdownMenuItem>
        </DropdownMenuGroup>
      </MenuRoot>

      <MenuRoot label="Vista">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onEdit}>Modo editar</DropdownMenuItem>
          <DropdownMenuItem onClick={onPreview} disabled={!onPreview}>Preview</DropdownMenuItem>
        </DropdownMenuGroup>
      </MenuRoot>

      <MenuRoot label="Insertar">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Graficos</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onAddWidget("bar")}>Grafico de barras</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddWidget("line")}>Grafico de lineas</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddWidget("pie")}>Grafico de torta</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddWidget("table")}>Tabla</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Contenido</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onAddWidget("kpi")}>KPI</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddWidget("text")}>Texto</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddWidget("image")}>Imagen</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddWidget("control_text")}>Control</DropdownMenuItem>
        </DropdownMenuGroup>
      </MenuRoot>

      <MenuRoot label="Pagina">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onAddPage}>Añadir pagina</DropdownMenuItem>
        </DropdownMenuGroup>
      </MenuRoot>

      <MenuRoot label="Organizar">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Widget seleccionado</DropdownMenuLabel>
          <DropdownMenuItem onClick={onBringToFront} disabled={!hasSelection}>Traer al frente</DropdownMenuItem>
          <DropdownMenuItem onClick={onSendToBack} disabled={!hasSelection}>Enviar atras</DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleLocked} disabled={!hasSelection}>Bloquear / desbloquear</DropdownMenuItem>
        </DropdownMenuGroup>
      </MenuRoot>

      <MenuRoot label="Recurso">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Datos</DropdownMenuLabel>
          <DropdownMenuItem disabled>Gestiona fuentes desde Datos</DropdownMenuItem>
          <DropdownMenuItem disabled>Combinar datos</DropdownMenuItem>
        </DropdownMenuGroup>
      </MenuRoot>

      <MenuRoot label="Ayuda">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Atajos</DropdownMenuLabel>
          <DropdownMenuItem disabled>Guardar: Ctrl S</DropdownMenuItem>
          <DropdownMenuItem disabled>Deshacer: Ctrl Z</DropdownMenuItem>
          <DropdownMenuItem disabled>Rehacer: Ctrl Y</DropdownMenuItem>
        </DropdownMenuGroup>
      </MenuRoot>
    </nav>
  );
}

function MenuRoot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className="rounded-sm px-2 py-0.5 text-sm text-foreground hover:bg-muted" />}>
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ToolButton({ label, shortcut, onClick, children }: { label: string; shortcut: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <TooltipButton label={label} shortcut={shortcut}>
      <Button title={label} aria-label={label} variant="ghost" size="icon-sm" onClick={onClick}>{children}</Button>
    </TooltipButton>
  );
}

function TooltipButton({ label, shortcut, children }: { label: string; shortcut: string; children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          {children}
        </TooltipTrigger>
        <TooltipContent>
          <span>{label}</span>
          <kbd data-slot="kbd" className="bg-background/15 px-1 py-0.5 font-mono text-[10px]">{shortcut}</kbd>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ModeButton({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      disabled={disabled}
      className="h-6 px-2 text-xs"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}
