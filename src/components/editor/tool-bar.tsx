"use client";

import { BarChart3, Image as ImageIcon, LayoutTemplate, ListFilter, PieChart, Table2, TextCursorInput, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useEditorStore } from "@/store/editor-store";
import type { WidgetType } from "@/types";

const chartItems: { type: WidgetType; label: string; icon: React.ElementType }[] = [
  { type: "bar", label: "Barra", icon: BarChart3 },
  { type: "line", label: "Línea", icon: BarChart3 },
  { type: "pie", label: "Torta", icon: PieChart },
  { type: "area", label: "Área", icon: BarChart3 },
  { type: "table", label: "Tabla", icon: Table2 },
  { type: "scorecard", label: "Scorecard", icon: LayoutTemplate },
];

export function ToolBar() {
  const addWidget = useEditorStore((state) => state.addWidget);
  const setZoom = useEditorStore((state) => state.setZoom);
  const zoom = useEditorStore((state) => state.zoom);

  return (
    <div className="dh-toolbar flex h-11 shrink-0 items-center gap-1 border-b px-3">
      {chartItems.map((item) => {
        const Icon = item.icon;
        return <Button key={item.type} variant="ghost" size="sm" onClick={() => addWidget(item.type)}><Icon className="mr-2 h-4 w-4" />{item.label}</Button>;
      })}
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button variant="ghost" size="sm" onClick={() => addWidget("control_text")}><ListFilter className="mr-2 h-4 w-4" />Control</Button>
      <Button variant="ghost" size="sm" onClick={() => addWidget("text")}><Type className="mr-2 h-4 w-4" />Texto</Button>
      <Button variant="ghost" size="sm" onClick={() => addWidget("image")}><ImageIcon className="mr-2 h-4 w-4" />Imagen</Button>
      <Button variant="ghost" size="sm" onClick={() => addWidget("kpi")}><TextCursorInput className="mr-2 h-4 w-4" />KPI</Button>
      <div className="ml-auto flex items-center gap-2 text-xs text-[var(--dh-gray-700)]">
        Zoom
        <input className="accent-[var(--dh-blue)]" type="range" min="0.55" max="1.4" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
