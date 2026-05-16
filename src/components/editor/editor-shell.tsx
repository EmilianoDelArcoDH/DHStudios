"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, PanelLeftOpen, PanelRightOpen, Pencil, Plus } from "lucide-react";
import { DataSourceManager } from "@/components/datasources/data-source-manager";
import { ReportCanvas } from "@/components/editor/report-canvas";
import { ToolBar } from "@/components/editor/tool-bar";
import { MenuBar, TopBar } from "@/components/editor/top-bar";
import { LeftPanel } from "@/components/panels/left-panel";
import { RightPanel } from "@/components/panels/right-panel";
import { useAutosave } from "@/hooks/use-autosave";
import { useEditorStore } from "@/store/editor-store";
import { Button } from "@/components/ui/button";
import { reportService } from "@/services/report-service";
import { cn } from "@/lib/utils";

const PANEL_PREFS_KEY = "dhstudios.editor.panels";
type EditorMode = "edit" | "preview";
type EditorView = "canvas" | "data-sources";

export function EditorShell({ projectId, readonly = false }: { projectId: string; readonly?: boolean }) {
  useAutosave();
  const { error, report, activePageId, setReport, setMode, selectWidget, selectPage, addPage } = useEditorStore();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not-found" | "forbidden" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
  const [editorView, setEditorView] = useState<EditorView>("canvas");
  const [managedDatasetId, setManagedDatasetId] = useState<string | undefined>();
  const [panelPrefsLoaded, setPanelPrefsLoaded] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const isPreview = editorMode === "preview";
  const isPresentationMode = readonly || isPreview;

  useEffect(() => {
    let active = true;
    void reportService
      .getReportByProjectId(projectId)
      .then((loaded) => {
        if (!active) return;
        if (!loaded) {
          setLoadState("not-found");
          return;
        }
        if (readonly && !loaded.isPublic) {
          setLoadState("forbidden");
          return;
        }
        setReport(loaded);
        setMode(readonly ? "view" : "edit");
        setLoadState("ready");
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : "No se pudo cargar el proyecto.");
        setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [projectId, readonly, setMode, setReport]);

  useEffect(() => {
    document.documentElement.style.setProperty("--primary", report.theme.primary);
  }, [report.theme.primary]);

  useEffect(() => {
    const hydratePanels = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(PANEL_PREFS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<{ leftPanelCollapsed: boolean; rightPanelCollapsed: boolean }>;
          setLeftPanelCollapsed(Boolean(parsed.leftPanelCollapsed));
          setRightPanelCollapsed(Boolean(parsed.rightPanelCollapsed));
        }
      } catch {
        window.localStorage.removeItem(PANEL_PREFS_KEY);
      } finally {
        setPanelPrefsLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(hydratePanels);
  }, []);

  useEffect(() => {
    if (!panelPrefsLoaded) return;
    window.localStorage.setItem(PANEL_PREFS_KEY, JSON.stringify({ leftPanelCollapsed, rightPanelCollapsed }));
  }, [leftPanelCollapsed, panelPrefsLoaded, rightPanelCollapsed]);

  const enterPreview = () => {
    selectWidget(undefined);
    setMode("view");
    setEditorMode("preview");
    setEditorView("canvas");
  };

  const exitPreview = () => {
    setMode("edit");
    setEditorMode("edit");
  };

  if (loadState !== "ready") {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-4 bg-[var(--dh-gray-ui)] px-6 text-center">
        <h1 className="text-xl font-semibold">{loadState === "loading" ? "Cargando proyecto..." : loadState === "not-found" ? "Proyecto no encontrado" : loadState === "forbidden" ? "Proyecto no compartido" : "No se pudo abrir el proyecto"}</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {loadState === "loading" ? projectId : loadState === "not-found" ? "No se encontró un proyecto con ese projectId." : loadState === "forbidden" ? "Este proyecto existe, pero no está marcado como público." : loadError}
        </p>
        {loadState !== "loading" ? <Button variant="outline"><Link href="/">Volver al Home</Link></Button> : null}
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {readonly ? null : isPreview ? (
        <header className="dh-toolbar flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Preview</span>
          <span className="rounded-sm border border-[var(--dh-border)] bg-card px-2 py-1 font-mono text-xs text-muted-foreground">{report.projectId}</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={exitPreview}>
            <Pencil className="mr-2 h-4 w-4" />
            Volver a editar
          </Button>
        </header>
      ) : (
        <TopBar readonly={readonly} onPreview={enterPreview} />
      )}
      {!readonly && !isPreview ? <MenuBar /> : null}
      {!readonly && !isPreview ? <ToolBar onAddData={() => {
        setManagedDatasetId(undefined);
        setEditorView("data-sources");
        selectWidget(undefined);
      }} /> : null}
      {error && !isPresentationMode ? <div className="border-b bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
      <div className="relative flex min-h-0 flex-1">
        {!readonly && !isPreview ? (
          <div
            aria-hidden={leftPanelCollapsed}
            className={cn("shrink-0 overflow-hidden transition-[width] duration-200 ease-out", leftPanelCollapsed ? "w-0" : "w-64")}
          >
            <LeftPanel
              onCollapse={() => setLeftPanelCollapsed(true)}
              onManageDataset={(datasetId) => {
                setManagedDatasetId(datasetId);
                setEditorView("data-sources");
                selectWidget(undefined);
              }}
            />
          </div>
        ) : null}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {!readonly && !isPreview && leftPanelCollapsed ? (
            <Button
              type="button"
              title="Mostrar panel izquierdo"
              aria-label="Mostrar panel izquierdo"
              variant="outline"
              size="icon-sm"
              className="absolute left-3 top-3 z-30 bg-card shadow-sm"
              onClick={() => setLeftPanelCollapsed(false)}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          ) : null}
          {!readonly && !isPreview && rightPanelCollapsed ? (
            <Button
              type="button"
              title="Mostrar panel derecho"
              aria-label="Mostrar panel derecho"
              variant="outline"
              size="icon-sm"
              className="absolute right-3 top-3 z-30 bg-card shadow-sm"
              onClick={() => setRightPanelCollapsed(false)}
            >
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          ) : null}
          {editorView === "data-sources" && !isPresentationMode ? (
            <DataSourceManager key={managedDatasetId ?? "data-sources"} initialDatasetId={managedDatasetId} onClose={() => setEditorView("canvas")} />
          ) : (
            <ReportCanvas preview={isPresentationMode} />
          )}
        </div>
        {!readonly && !isPreview ? (
          <div
            aria-hidden={rightPanelCollapsed}
            className={cn("shrink-0 overflow-hidden transition-[width] duration-200 ease-out", rightPanelCollapsed ? "w-0" : "w-80")}
          >
            <RightPanel onCollapse={() => setRightPanelCollapsed(true)} />
          </div>
        ) : null}
      </div>
      {!isPresentationMode ? (
        <nav className="dh-toolbar flex h-9 shrink-0 items-center gap-0 overflow-x-auto border-t">
          {report.pages.map((page) => (
            <button
              key={page.id}
              type="button"
              className={cn(
                "flex h-full items-center whitespace-nowrap border-r px-4 text-xs font-medium transition-colors hover:bg-muted",
                activePageId === page.id ? "border-b-2 border-b-primary bg-background text-foreground" : "text-muted-foreground",
              )}
              onClick={() => selectPage(page.id)}
            >
              {page.name}
            </button>
          ))}
          <button
            type="button"
            title="Agregar página"
            aria-label="Agregar página"
            onClick={addPage}
            className="flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
