"use client";

import { useState } from "react";
import { Database, FileUp, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchPublishedCsv, parseCsvDataset, parseXlsxDataset } from "@/lib/dataset";
import { createDemoDataset } from "@/lib/demo-data";
import { useEditorStore } from "@/store/editor-store";

export function DatasourceUploader() {
  const addDataset = useEditorStore((state) => state.addDataset);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      const datasetName = file.name.replace(/\.(csv|xlsx)$/i, "");
      if (/\.xlsx$/i.test(file.name)) {
        addDataset(parseXlsxDataset(datasetName, await file.arrayBuffer()));
      } else {
        addDataset(parseCsvDataset(datasetName, await file.text()));
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archivo invalido.");
    }
  };

  const onUrl = async () => {
    try {
      addDataset(parseCsvDataset("Google Sheets publicado", await fetchPublishedCsv(url), "google_sheets", url));
      setUrl("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar.");
    }
  };

  return (
    <div className="space-y-3">
      <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--dh-border)] bg-card text-sm font-semibold hover:bg-accent">
        <FileUp className="h-4 w-4" />
        Subir CSV o XLSX
        <input
          type="file"
          accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      <div className="space-y-2">
        <Label>Sheets publicado o CSV URL</Label>
        <div className="flex gap-2">
          <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
          <Button size="icon" variant="outline" onClick={() => void onUrl()} disabled={!url}><Link className="h-4 w-4" /></Button>
        </div>
      </div>
      <Button variant="outline" className="w-full" onClick={() => addDataset(createDemoDataset())}><Database className="mr-2 h-4 w-4" />Datos demo</Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
