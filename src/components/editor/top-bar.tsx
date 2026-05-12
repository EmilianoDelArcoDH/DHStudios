"use client";

import { useEffect, useState } from "react";
import { Download, Eye, FileJson, Redo2, Save, Share2, Undo2 } from "lucide-react";
import { EditorSettingsSheet } from "@/components/editor/editor-settings-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useEditorStore } from "@/store/editor-store";
import { exportReport, importReport } from "@/lib/report-io";
import { reportService } from "@/services/report-service";

const APPEARANCE_STORAGE_KEY = "dhstudios.appearance";

export function TopBar({ readonly = false }: { readonly?: boolean }) {
  const { report, mode, loading, updateReport, setMode, undo, redo, autosave, setReport } = useEditorStore();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(APPEARANCE_STORAGE_KEY) === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

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

  return (
    <header className="dh-toolbar flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <Input value={report.name} onChange={(event) => updateReport({ name: event.target.value })} disabled={readonly} className="h-8 w-72 border-transparent bg-card text-base font-semibold shadow-none" />
      <span className="rounded-sm border border-[var(--dh-border)] bg-card px-2 py-1 font-mono text-xs text-muted-foreground">{report.projectId}</span>
      <div className="ml-auto flex items-center gap-1">
        {!readonly ? <EditorSettingsSheet darkMode={darkMode} onDarkModeChange={handleDarkModeChange} /> : null}
        {!readonly ? <ToolButton label="Deshacer" onClick={undo}><Undo2 className="h-4 w-4" /></ToolButton> : null}
        {!readonly ? <ToolButton label="Rehacer" onClick={redo}><Redo2 className="h-4 w-4" /></ToolButton> : null}
        {!readonly ? <ToolButton label="Guardar" onClick={() => void autosave()}><Save className="h-4 w-4" /></ToolButton> : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!readonly) updateReport({ isPublic: true });
            void navigator.clipboard.writeText(publicUrl);
          }}
        >
          <Share2 className="mr-2 h-4 w-4" />Compartir
        </Button>
        <Button variant="ghost" size="sm" onClick={download}><Download className="mr-2 h-4 w-4" />Informe</Button>
        {!readonly ? <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-semibold hover:bg-accent">
          <FileJson className="h-4 w-4" />
          Importar
          <input type="file" accept="application/json" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
        </label> : null}
        <div className="mx-2 h-6 w-px bg-border" />
        <Eye className="h-4 w-4 text-muted-foreground" />
        <Switch checked={!readonly && mode === "edit"} disabled={readonly} onCheckedChange={(checked) => setMode(checked ? "edit" : "view")} />
        <span className="w-16 text-xs text-muted-foreground">{readonly || mode === "view" ? "Ver" : "Editar"}</span>
        <span className="w-24 text-xs text-muted-foreground">{loading ? "Guardando..." : "Guardado"}</span>
      </div>
    </header>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <Button title={label} aria-label={label} variant="ghost" size="icon" onClick={onClick} className="h-8 w-8">{children}</Button>;
}
