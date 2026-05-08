"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth/auth-panel";
import { ReportCanvas } from "@/components/editor/report-canvas";
import { ToolBar } from "@/components/editor/tool-bar";
import { TopBar } from "@/components/editor/top-bar";
import { LeftPanel } from "@/components/panels/left-panel";
import { RightPanel } from "@/components/panels/right-panel";
import { useAutosave } from "@/hooks/use-autosave";
import { useEditorStore } from "@/store/editor-store";
import { Button } from "@/components/ui/button";
import { reportService } from "@/services/report-service";

export function EditorShell({ projectId, readonly = false }: { projectId: string; readonly?: boolean }) {
  useAutosave();
  const { error, report, setReport, setMode } = useEditorStore();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not-found" | "forbidden" | "error">("loading");
  const [loadError, setLoadError] = useState("");

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

  if (loadState !== "ready") {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-4 bg-[var(--dh-gray-ui)] px-6 text-center">
        <h1 className="text-xl font-semibold">{loadState === "loading" ? "Cargando proyecto..." : loadState === "not-found" ? "Proyecto no encontrado" : loadState === "forbidden" ? "Proyecto no compartido" : "No se pudo abrir el proyecto"}</h1>
        <p className="max-w-md text-sm text-[var(--dh-gray-700)]">
          {loadState === "loading" ? projectId : loadState === "not-found" ? "No se encontró un proyecto con ese projectId." : loadState === "forbidden" ? "Este proyecto existe, pero no está marcado como público." : loadError}
        </p>
        {loadState !== "loading" ? <Button variant="outline"><Link href="/">Volver al Home</Link></Button> : null}
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar readonly={readonly} />
      {!readonly ? <ToolBar /> : null}
      {error ? <div className="border-b bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
      <div className="flex min-h-0 flex-1">
        {!readonly ? <LeftPanel /> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          {!readonly ? <div className="hidden border-b bg-white p-2 xl:block"><AuthPanel /></div> : null}
          <ReportCanvas />
        </div>
        {!readonly ? <RightPanel /> : null}
      </div>
    </div>
  );
}
