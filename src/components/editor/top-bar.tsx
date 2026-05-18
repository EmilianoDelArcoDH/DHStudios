"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, Copy, Download, Eye, FileJson, LayoutGrid, Presentation, Save, Share2, UserCircle } from "lucide-react";
import { EditorSettingsSheet } from "@/components/editor/editor-settings-sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorStore } from "@/store/editor-store";
import { exportReport, importReport } from "@/lib/report-io";
import { reportService } from "@/services/report-service";
import { cn } from "@/lib/utils";

const APPEARANCE_STORAGE_KEY = "dhstudios.appearance";

export function TopBar({ readonly = false, onPreview }: { readonly?: boolean; onPreview?: () => void }) {
  const {
    report,
    activePageId,
    mode,
    loading,
    updateReport,
    setMode,
    undo,
    redo,
    autosave,
    setReport,
  } = useEditorStore();
  const activePage = report.pages.find((page) => page.id === activePageId) ?? report.pages[0];
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
      <header className="dh-toolbar flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground">
          <LayoutGrid className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <Input
              value={report.name}
              onChange={(event) => updateReport({ name: event.target.value })}
              disabled={readonly}
              className="h-7 w-full max-w-64 border-transparent bg-transparent px-1.5 text-sm font-medium shadow-none hover:bg-muted focus-visible:border-primary focus-visible:bg-transparent focus-visible:ring-1 focus-visible:ring-primary"
            />
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground md:block" />
            <span className="hidden max-w-36 truncate text-xs text-muted-foreground md:block">{activePage?.name ?? "Página"}</span>
            <span className="hidden truncate font-mono text-[11px] text-muted-foreground/70 xl:inline">{report.projectId}</span>
          </div>
        </div>

        <div className="hidden min-w-20 shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          {loading ? <Save className="h-3.5 w-3.5 animate-pulse text-amber-500" /> : <Check className="h-3.5 w-3.5 text-emerald-500" />}
          <span>{loading ? "Guardando..." : "Guardado"}</span>
        </div>

        <div className="h-7 w-px shrink-0 bg-border" />

        {!readonly ? (
          <div className="hidden items-center rounded-full border border-border bg-muted p-0.5 md:flex">
            <ModeButton active={mode === "edit"} onClick={() => setMode("edit")}>Editar</ModeButton>
            <ModeButton active={mode === "view"} onClick={() => onPreview?.()}>
              <Eye className="mr-1 h-3.5 w-3.5" />
              Vista previa
            </ModeButton>
            <ModeButton active={false} onClick={() => onPreview?.()}>
              <Presentation className="mr-1 h-3.5 w-3.5" />
              Presentar
            </ModeButton>
          </div>
        ) : (
          <div className="hidden items-center rounded-full border border-border bg-muted p-0.5 md:flex">
            <ModeButton active disabled onClick={() => undefined}>Ver</ModeButton>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {!readonly ? (
            <TooltipButton label="Guardar" shortcut="Ctrl S">
              <Button variant="default" size="sm" onClick={() => void autosave()} disabled={loading}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Guardar
              </Button>
            </TooltipButton>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="rounded-full" title="Más acciones" aria-label="Más acciones" />}>
              <Download className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => void openShareDialog()} disabled={shareState === "sharing"}>
                  <Share2 className="h-4 w-4" />
                  Compartir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={download}>
                  <FileJson className="h-4 w-4" />
                  Exportar JSON
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
          <Button variant="ghost" size="icon-sm" className="rounded-full" title="Usuario" aria-label="Usuario">
            <UserCircle className="h-5 w-5" />
          </Button>
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

type TopMenuProps = {
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
};

export function MenuBar() {
  const {
    report,
    selectedWidgetId,
    autosave,
    setReport,
    updateReport,
    setMode,
    undo,
    redo,
    addPage,
    addWidget,
    bringWidgetToFront,
    sendWidgetToBack,
    toggleWidgetLocked,
  } = useEditorStore();

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

  const publish = async () => {
    const publishedReport = { ...report, isPublic: true, updatedAt: new Date().toISOString() };
    updateReport({ isPublic: true });
    await reportService.saveReport(publishedReport);
  };

  return (
    <nav className="dh-toolbar flex h-9 shrink-0 items-center gap-0.5 border-b px-2">
      <TopMenu
        onSave={() => void autosave()}
        onDownload={download}
        onUpload={upload}
        onShare={() => void publish()}
        onUndo={undo}
        onRedo={redo}
        onEdit={() => setMode("edit")}
        onAddPage={addPage}
        onAddWidget={addWidget}
        selectedWidgetId={selectedWidgetId}
        onBringToFront={() => selectedWidgetId ? bringWidgetToFront(selectedWidgetId) : undefined}
        onSendToBack={() => selectedWidgetId ? sendWidgetToBack(selectedWidgetId) : undefined}
        onToggleLocked={() => selectedWidgetId ? toggleWidgetLocked(selectedWidgetId) : undefined}
      />
    </nav>
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
}: TopMenuProps) {
  const hasSelection = Boolean(selectedWidgetId);

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto text-sm">
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
          <DropdownMenuItem onClick={onPreview} disabled={!onPreview}>Vista previa</DropdownMenuItem>
        </DropdownMenuGroup>
      </MenuRoot>

      <MenuRoot label="Insertar">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Gráficos</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onAddWidget("bar")}>Gráfico de barras</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddWidget("line")}>Gráfico de líneas</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddWidget("pie")}>Gráfico de torta</DropdownMenuItem>
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

      <MenuRoot label="Página">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onAddPage}>Añadir página</DropdownMenuItem>
        </DropdownMenuGroup>
      </MenuRoot>

      <MenuRoot label="Organizar">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Widget seleccionado</DropdownMenuLabel>
          <DropdownMenuItem onClick={onBringToFront} disabled={!hasSelection}>Traer al frente</DropdownMenuItem>
          <DropdownMenuItem onClick={onSendToBack} disabled={!hasSelection}>Enviar atrás</DropdownMenuItem>
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
    </div>
  );
}

function MenuRoot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className="rounded px-2.5 py-1 text-[13px] text-foreground hover:bg-muted" />}>
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
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
      variant="ghost"
      size="sm"
      disabled={disabled}
      className={cn(
        "h-6 rounded-full px-3 text-xs font-medium transition-all",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
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
