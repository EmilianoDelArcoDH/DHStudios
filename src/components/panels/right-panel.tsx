"use client";

import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useEditorStore } from "@/store/editor-store";
import type { Aggregation, ColumnType, ReportTheme, WidgetType } from "@/types";
import { cn } from "@/lib/utils";

const aggregations: Aggregation[] = ["sum", "avg", "count", "min", "max"];
const EMPTY_SELECT_VALUE = "__none__";
const defaultSeriesColors = ["#3333ff", "#00cc7e", "#ffc51a", "#ff7059", "#8a6df1", "#ff76e2"];
const chartTypes: { value: WidgetType; label: string }[] = [
  { value: "bar", label: "Barra vertical" },
  { value: "horizontal_bar", label: "Barra horizontal" },
  { value: "stacked_bar", label: "Barra apilada" },
  { value: "line", label: "Línea" },
  { value: "multi_line", label: "Múltiples líneas" },
  { value: "area", label: "Área" },
  { value: "combo", label: "Combo barra/línea" },
  { value: "pie", label: "Torta" },
  { value: "donut", label: "Dona" },
  { value: "scatter", label: "Dispersión" },
  { value: "table", label: "Tabla" },
  { value: "kpi", label: "KPI" },
  { value: "scorecard", label: "Scorecard" },
];
const editableChartTypes = new Set(chartTypes.map((item) => item.value));

export function RightPanel() {
  const { report, activePageId, selectedWidgetId, updateWidget, removeWidget, updateTheme } = useEditorStore();
  const page = report.pages.find((item) => item.id === activePageId);
  const widget = page?.widgets.find((item) => item.id === selectedWidgetId);
  const dataset = report.datasets.find((item) => item.id === widget?.config.datasetId);

  if (!widget) {
    return (
      <aside className="w-80 shrink-0 border-l border-[var(--dh-border)] bg-white p-4">
        <h2 className="text-sm font-semibold">Propiedades</h2>
        <p className="mt-2 text-sm text-[var(--dh-gray-700)]">No hay componente seleccionado.</p>
        <Separator className="my-4" />
        <ThemeControls updateTheme={updateTheme} theme={report.theme} />
      </aside>
    );
  }

  const setConfig = (patch: Partial<typeof widget.config>) => updateWidget(widget.id, { config: { ...widget.config, ...patch } });
  const setStyle = (patch: Partial<typeof widget.style>) => updateWidget(widget.id, { style: { ...widget.style, ...patch } });
  const columns = dataset?.columns ?? [];
  const metricColumns = columns.filter((column) => column.type === "number");
  const seriesColors = widget.style.seriesColors?.length ? widget.style.seriesColors : defaultSeriesColors;

  return (
    <aside className="w-80 shrink-0 border-l border-[var(--dh-border)] bg-white">
      <Tabs defaultValue="datos" className="flex h-full flex-col">
        <TabsList className="m-3 grid grid-cols-2 rounded-md bg-[var(--dh-gray-ui)]"><TabsTrigger value="datos">Datos</TabsTrigger><TabsTrigger value="estilo">Estilo</TabsTrigger></TabsList>
        <TabsContent value="datos" className="min-h-0 flex-1 space-y-4 overflow-auto px-4 pb-4">
          <Field label="Fuente de datos">
            <Select value={widget.config.datasetId ?? EMPTY_SELECT_VALUE} onValueChange={(value) => setConfig({ datasetId: !value || value === EMPTY_SELECT_VALUE ? undefined : value })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>Sin fuente</SelectItem>
                {report.datasets.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {editableChartTypes.has(widget.type) ? (
            <Field label="Tipo de gráfico">
              <Select value={widget.type} onValueChange={(value) => updateWidget(widget.id, { type: value as WidgetType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{chartTypes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          ) : null}
          <ColumnList
            label="Dimensiones"
            values={widget.config.dimensions ?? (widget.config.dimension ? [widget.config.dimension] : [])}
            columns={columns}
            addLabel="Agregar dimensión"
            onChange={(dimensions) => setConfig({ dimensions, dimension: dimensions[0] })}
          />
          <ColumnList
            label="Métricas"
            values={widget.config.metrics ?? (widget.config.metric ? [widget.config.metric] : [])}
            columns={metricColumns}
            addLabel="Agregar métrica"
            onChange={(metrics) => setConfig({ metrics, metric: metrics[0] })}
          />
          <p className="text-xs text-[var(--dh-gray-700)]">Las dimensiones y métricas extra son opcionales. Para dispersión usá dos métricas numéricas: eje X y eje Y.</p>
          <Field label="Agregación">
            <Select value={widget.config.aggregation} onValueChange={(value) => setConfig({ aggregation: value as Aggregation })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{aggregations.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Orden">
            <Select value={widget.config.orderDirection ?? "asc"} onValueChange={(value) => setConfig({ orderDirection: value as "asc" | "desc" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="asc">Ascendente</SelectItem><SelectItem value="desc">Descendente</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Límite de filas">
            <Input type="number" value={widget.config.limit ?? 20} onChange={(event) => setConfig({ limit: Number(event.target.value) })} />
          </Field>
          <Button variant="destructive" className="w-full" onClick={() => removeWidget(widget.id)}><Trash2 className="mr-2 h-4 w-4" />Eliminar componente</Button>
        </TabsContent>
        <TabsContent value="estilo" className="min-h-0 flex-1 space-y-4 overflow-auto px-4 pb-4">
          <Field label="Título"><Input value={widget.style.title ?? ""} onChange={(event) => setStyle({ title: event.target.value })} /></Field>
          <Field label="Texto"><Input value={widget.style.text ?? ""} onChange={(event) => setStyle({ text: event.target.value })} /></Field>
          <Field label="URL de imagen"><Input value={widget.style.imageUrl ?? ""} onChange={(event) => setStyle({ imageUrl: event.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Texto"><Input type="color" value={widget.style.color ?? "#1f2937"} onChange={(event) => setStyle({ color: event.target.value })} /></Field>
            <Field label="Fondo"><Input type="color" value={widget.style.background ?? "#ffffff"} onChange={(event) => setStyle({ background: event.target.value })} /></Field>
            <Field label="Borde"><Input type="color" value={widget.style.borderColor ?? "#d7dce2"} onChange={(event) => setStyle({ borderColor: event.target.value })} /></Field>
            <Field label="Tamaño"><Input type="number" value={widget.style.fontSize ?? 13} onChange={(event) => setStyle({ fontSize: Number(event.target.value) })} /></Field>
          </div>
          <Field label="Radio de borde"><Input type="number" value={widget.style.borderRadius ?? 4} onChange={(event) => setStyle({ borderRadius: Number(event.target.value) })} /></Field>
          <div className="flex items-center justify-between"><Label>Leyenda</Label><Switch checked={widget.style.showLegend ?? true} onCheckedChange={(showLegend) => setStyle({ showLegend })} /></div>
          <div className="flex items-center justify-between"><Label>Etiquetas</Label><Switch checked={widget.style.showDataLabels ?? false} onCheckedChange={(showDataLabels) => setStyle({ showDataLabels })} /></div>
          <div className="flex items-center justify-between"><Label>% en torta/dona</Label><Switch checked={widget.style.showPiePercent ?? false} onCheckedChange={(showPiePercent) => setStyle({ showPiePercent })} /></div>
          <div className="flex items-center justify-between"><Label>Apilar series</Label><Switch checked={widget.style.stackSeries ?? false} onCheckedChange={(stackSeries) => setStyle({ stackSeries })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Grosor línea"><Input type="number" min={1} max={8} value={widget.style.lineWidth ?? 2} onChange={(event) => setStyle({ lineWidth: Number(event.target.value) })} /></Field>
            <Field label="Radio barra"><Input type="number" min={0} max={12} value={widget.style.barRadius ?? 3} onChange={(event) => setStyle({ barRadius: Number(event.target.value) })} /></Field>
            <Field label="Radio interno"><Input type="number" min={0} max={80} value={widget.style.pieInnerRadius ?? 0} onChange={(event) => setStyle({ pieInnerRadius: Number(event.target.value) })} /></Field>
            <Field label="Radio externo"><Input type="number" min={10} max={90} value={widget.style.pieOuterRadius ?? 58} onChange={(event) => setStyle({ pieOuterRadius: Number(event.target.value) })} /></Field>
          </div>
          <Field label="Colores de series">
            <div className="grid grid-cols-6 gap-2">
              {seriesColors.slice(0, 6).map((color, index) => (
                <Input
                  key={`${index}-${color}`}
                  type="color"
                  value={color}
                  onChange={(event) => {
                    const next = [...seriesColors];
                    next[index] = event.target.value;
                    setStyle({ seriesColors: next });
                  }}
                />
              ))}
            </div>
          </Field>
          <Separator />
          <ThemeControls updateTheme={updateTheme} theme={report.theme} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function ColumnList({
  label,
  values,
  columns,
  addLabel,
  onChange,
}: {
  label: string;
  values: string[];
  columns: { name: string; type: ColumnType }[];
  addLabel: string;
  onChange: (values: string[]) => void;
}) {
  const rows = values.length ? values : [""];

  return (
    <Field label={label}>
      <div className="space-y-2">
        {rows.map((value, index) => (
          <div key={`${label}-${index}`} className="flex items-center gap-2">
            <Select
              value={value || EMPTY_SELECT_VALUE}
              onValueChange={(next) => {
                const updated = [...values];
                if (!next || next === EMPTY_SELECT_VALUE) updated.splice(index, 1);
                else updated[index] = next;
                onChange(updated);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>Sin selección</SelectItem>
                {columns.map((column) => <SelectItem key={column.name} value={column.name}>{column.name} · {column.type}</SelectItem>)}
              </SelectContent>
            </Select>
            {rows.length > 1 ? (
              <Button variant="ghost" size="icon-sm" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className={cn("w-full", rows.some((value) => !value) && "opacity-60")}
          onClick={() => onChange([...values, ""])}
          disabled={columns.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          {addLabel}
        </Button>
      </div>
    </Field>
  );
}

function ThemeControls({ theme, updateTheme }: { theme: ReportTheme; updateTheme: (theme: Partial<ReportTheme>) => void }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Tema del reporte</h3>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Primario"><Input type="color" value={theme.primary} onChange={(event) => updateTheme({ primary: event.target.value })} /></Field>
        <Field label="Acento"><Input type="color" value={theme.accent} onChange={(event) => updateTheme({ accent: event.target.value })} /></Field>
        <Field label="Hoja"><Input type="color" value={theme.pageBackground} onChange={(event) => updateTheme({ pageBackground: event.target.value })} /></Field>
      </div>
    </div>
  );
}
