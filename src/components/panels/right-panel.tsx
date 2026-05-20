"use client";

import { PanelRightClose, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useEditorStore } from "@/store/editor-store";
import type { Aggregation, ColumnType, ContentAlign, Dataset, DimensionGroupingMode, LegendLayout, ReportWidget, WidgetFilter, WidgetMetric, WidgetStyle, WidgetType } from "@/types";
import { aggregationOrFallback, getDatasetColumnConfig, getVisibleDatasetColumns, isRecordCountMetric, RECORD_COUNT_LABEL, RECORD_COUNT_METRIC } from "@/lib/dataset";
import { cn } from "@/lib/utils";
import type { DataModel, DatasetRelationship } from "@/lib/data-model/types";

const aggregations: Aggregation[] = ["sum", "avg", "count", "countDistinct", "min", "max"];
const EMPTY_SELECT_VALUE = "__none__";
const defaultSeriesColors = ["#3333ff", "#00cc7e", "#ffc51a", "#ff7059", "#8a6df1", "#ff76e2"];
const aggregationLabels: Record<Aggregation, string> = {
  sum: "Suma",
  avg: "Promedio",
  count: "Conteo",
  countDistinct: "Conteo único",
  min: "Mínimo",
  max: "Máximo",
};
const columnTypeLabels: Record<ColumnType, string> = {
  text: "Texto",
  number: "Número",
  date: "Fecha",
  boolean: "Booleano",
};
const legendPositionLabels: Record<NonNullable<ReportWidget["config"]["legendPosition"]>, string> = {
  top: "Arriba",
  bottom: "Abajo",
  left: "Izquierda",
  right: "Derecha",
};
const valueFormatLabels: Record<NonNullable<ReportWidget["config"]["valueFormat"]>, string> = {
  number: "Número",
  currency: "Moneda",
  percentage: "Porcentaje",
};
const stylePresetLabels: Record<NonNullable<ReportWidget["config"]["stylePreset"]>, string> = {
  modern: "Moderno",
  minimal: "Minimalista",
  corporate: "Corporativo",
  vibrant: "Vibrante",
};
const dimensionGroupingLabels: Record<DimensionGroupingMode, string> = {
  none: "Todas",
  top_n: "Las primeras N",
  bottom_n: "Las últimas N",
};

const contentAlignLabels: Record<ContentAlign, string> = {
  left: "Izquierda",
  center: "Centro",
  right: "Derecha",
};
const textAlignLabels: Record<NonNullable<WidgetStyle["textAlign"]>, string> = {
  left: "Izquierda",
  center: "Centro",
  right: "Derecha",
  justify: "Justificado",
};
const legendLayoutLabels: Record<LegendLayout, string> = {
  auto: "Automática",
  list: "Lista",
};

const cartesianChartTypes: ChartTypeOption[] = [
  { value: "bar", label: "Barra vertical" },
  { value: "horizontal_bar", label: "Barra horizontal" },
  { value: "stacked_bar", label: "Barra apilada" },
  { value: "line", label: "Línea" },
  { value: "multi_line", label: "Múltiples líneas" },
  { value: "area", label: "Área" },
  { value: "combo", label: "Combo barra/línea" },
];
const pieChartTypes: ChartTypeOption[] = [
  { value: "pie", label: "Torta" },
  { value: "donut", label: "Dona" },
];
const scatterChartTypes: ChartTypeOption[] = [{ value: "scatter", label: "Dispersión" }];
const tableChartTypes: ChartTypeOption[] = [{ value: "table", label: "Tabla" }, { value: "pivot_table", label: "Tabla dinámica" }];
const scoreChartTypes: ChartTypeOption[] = [
  { value: "kpi", label: "KPI" },
  { value: "scorecard", label: "Tarjeta" },
];

const cartesianTypes = new Set(cartesianChartTypes.map((item) => item.value));
const pieTypes = new Set(pieChartTypes.map((item) => item.value));
const scatterTypes = new Set(scatterChartTypes.map((item) => item.value));
const tableTypes = new Set(tableChartTypes.map((item) => item.value));
const scoreTypes = new Set(scoreChartTypes.map((item) => item.value));

type ChartTypeOption = { value: WidgetType; label: string };
type ColumnOption = { name: string; label?: string; type: ColumnType; defaultAggregation?: import("@/types").AggregationType };
const recordCountOption: ColumnOption = {
  name: RECORD_COUNT_METRIC,
  label: RECORD_COUNT_LABEL,
  type: "number",
  defaultAggregation: "count",
};

function metricKey(metric: string | WidgetMetric) {
  return typeof metric === "string" ? metric : metric.column ?? metric.id;
}

function compatibleTypes(type: WidgetType) {
  if (cartesianTypes.has(type)) return cartesianChartTypes;
  if (pieTypes.has(type)) return pieChartTypes;
  if (scoreTypes.has(type)) return scoreChartTypes;
  if (scatterTypes.has(type)) return scatterChartTypes;
  if (tableTypes.has(type)) return tableChartTypes;
  return [];
}

export function RightPanel({ onCollapse }: { onCollapse?: () => void }) {
  const { report, activePageId, selectedWidgetId, updateWidget, removeWidget, updateDataModel, updateReport, updatePage } = useEditorStore();
  const page = report.pages.find((item) => item.id === activePageId);
  const widget = page?.widgets.find((item) => item.id === selectedWidgetId);
  const dataset = report.datasets.find((item) => item.id === widget?.config.datasetId);
  const dataModel = report.dataModel ?? { relationships: [] };

  if (!widget) {
    return (
      <aside className="flex h-full w-80 shrink-0 flex-col overflow-hidden border-l border-border bg-card">
        <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Propiedades</h2>
          {onCollapse ? (
            <Button title="Ocultar panel derecho" aria-label="Ocultar panel derecho" variant="ghost" size="icon" className="h-7 w-7" onClick={onCollapse}>
              <PanelRightClose className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          <p className="text-sm text-muted-foreground">No hay componente seleccionado.</p>
          <FilterControls
            title="Filtros del reporte"
            filters={report.filters ?? []}
            columns={report.datasets[0] ? getVisibleDatasetColumns(report.datasets[0]) : []}
            onChange={(filters) => updateReport({ filters })}
          />
          {page ? (
            <FilterControls
              title="Filtros de página"
              filters={page.filters ?? []}
              columns={report.datasets[0] ? getVisibleDatasetColumns(report.datasets[0]) : []}
              onChange={(filters) => updatePage(page.id, { filters })}
            />
          ) : null}
          <Separator />
          <DataModelControls reportDatasets={report.datasets} dataModel={dataModel} updateDataModel={updateDataModel} />
        </div>
      </aside>
    );
  }

  const setConfig = (patch: Partial<typeof widget.config>) => updateWidget(widget.id, { config: { ...widget.config, ...patch } });
  const setStyle = (patch: Partial<WidgetStyle>) => updateWidget(widget.id, { style: { ...widget.style, ...patch } });
  const columns = dataset ? getVisibleDatasetColumns(dataset) : [];
  const metricColumns = columns.filter((column) => column.type === "number");
  const aggregateMetricColumns = [...metricColumns, recordCountOption];
  const dimensionColumns = getDimensionColumns(report.datasets, dataModel, widget.config.datasetId);
  const selectedMetrics = (widget.config.metrics ?? (widget.config.metric ? [widget.config.metric] : [])).map(metricKey);
  const seriesColors = widget.style.seriesColors?.length ? widget.style.seriesColors : defaultSeriesColors;
  const typeOptions = compatibleTypes(widget.type);
  const isText = widget.type === "text";
  const isImage = widget.type === "image";
  const isScore = scoreTypes.has(widget.type);
  const isScatter = scatterTypes.has(widget.type);
  const isPie = pieTypes.has(widget.type);
  const isCartesian = cartesianTypes.has(widget.type);
  const isTable = tableTypes.has(widget.type);
  const isPivot = widget.type === "pivot_table";
  const isControl = widget.type.startsWith("control");
  const showDataSource = isScore || isScatter || isPie || isCartesian || isTable || isControl;
  const showDimensionGrouping = isPie || isCartesian;
  const controlColumns = widget.type === "control_date" ? columns.filter((column) => column.type === "date") : columns;

  const setSingleDimension = (dimension?: string) => setConfig({ dimension, dimensions: dimension ? [dimension] : [] });
  const suggestedAggregation = (metric?: string) => {
    if (isRecordCountMetric(metric)) return "count";
    return aggregationOrFallback(aggregateMetricColumns.find((column) => column.name === metric)?.defaultAggregation, widget.config.aggregation);
  };
  const setSingleMetric = (metric?: string) => setConfig({ metric, metrics: metric ? [metric] : [], aggregation: suggestedAggregation(metric) });
  const setScatterMetric = (index: number, metric?: string) => {
    const next = [...selectedMetrics];
    if (!metric) next.splice(index, 1);
    else next[index] = metric;
    const cleaned = next.filter(Boolean);
    setConfig({ metric: cleaned[0], metrics: cleaned, aggregation: suggestedAggregation(cleaned[0]) });
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-hidden border-l border-border bg-card">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Propiedades</h2>
        {onCollapse ? (
          <Button title="Ocultar panel derecho" aria-label="Ocultar panel derecho" variant="ghost" size="icon" className="h-7 w-7" onClick={onCollapse}>
            <PanelRightClose className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <Tabs defaultValue="datos" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="grid h-9 w-full grid-cols-2 rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="datos"
            className="h-full rounded-none border-b-2 border-transparent text-xs font-medium focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none data-active:border-primary data-active:bg-transparent data-active:text-primary data-active:shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            Datos
          </TabsTrigger>
          <TabsTrigger
            value="estilo"
            className="h-full rounded-none border-b-2 border-transparent text-xs font-medium focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none data-active:border-primary data-active:bg-transparent data-active:text-primary data-active:shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            Estilo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="dh-props-panel h-0 min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-contain pb-4">
          {typeOptions.length > 1 ? (
            <Field label="Tipo de gráfico">
              <Select value={widget.type} onValueChange={(value) => updateWidget(widget.id, { type: value as WidgetType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{typeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          ) : null}

          {isText ? (
            <>
              <div className="flex items-center justify-between"><Label>Mostrar título</Label><Switch checked={widget.style.showTitle ?? true} onCheckedChange={(showTitle) => setStyle({ showTitle })} /></div>
              <Field label="Título"><Input value={widget.style.title ?? ""} onChange={(event) => setStyle({ title: event.target.value })} /></Field>
              <Field label="Texto"><Input value={widget.style.text ?? ""} onChange={(event) => setStyle({ text: event.target.value })} /></Field>
            </>
          ) : null}

          {isImage ? (
            <>
              <div className="flex items-center justify-between"><Label>Mostrar título</Label><Switch checked={widget.style.showTitle ?? false} onCheckedChange={(showTitle) => setStyle({ showTitle })} /></div>
              <Field label="Título"><Input value={widget.style.title ?? ""} onChange={(event) => setStyle({ title: event.target.value })} /></Field>
              <Field label="URL de imagen"><Input value={widget.style.imageUrl ?? ""} onChange={(event) => setStyle({ imageUrl: event.target.value })} /></Field>
            </>
          ) : null}

          {showDataSource ? (
            <Field label="Fuente de datos">
              <Select value={widget.config.datasetId ?? EMPTY_SELECT_VALUE} onValueChange={(value) => setConfig({ datasetId: !value || value === EMPTY_SELECT_VALUE ? undefined : value })}>
                <SelectTrigger className="w-full min-w-0">
                  <span className="truncate text-left">{dataset?.name ?? "Seleccionar"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SELECT_VALUE}>Sin fuente</SelectItem>
                  {report.datasets.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {isControl ? (
            <>
              <div className="flex items-center justify-between"><Label>Mostrar título</Label><Switch checked={widget.style.showTitle ?? true} onCheckedChange={(showTitle) => setStyle({ showTitle })} /></div>
              <SingleColumnSelect label="Campo de filtro" value={widget.config.dimension} columns={controlColumns} onChange={setSingleDimension} />
              <Field label="Título"><Input value={widget.style.title ?? ""} onChange={(event) => setStyle({ title: event.target.value })} /></Field>
            </>
          ) : null}

          {isScore ? (
            <>
              <SingleColumnSelect label="Métrica" value={widget.config.metric} columns={aggregateMetricColumns} onChange={setSingleMetric} />
              <AggregationField value={widget.config.aggregation} onChange={(aggregation) => setConfig({ aggregation })} />
            </>
          ) : null}

          {isScatter ? (
            <>
              <SingleColumnSelect label="Métrica eje X" value={selectedMetrics[0]} columns={metricColumns} onChange={(metric) => setScatterMetric(0, metric)} />
              <SingleColumnSelect label="Métrica eje Y" value={selectedMetrics[1]} columns={metricColumns} onChange={(metric) => setScatterMetric(1, metric)} />
              <LimitField value={widget.config.limit} onChange={(limit) => setConfig({ limit })} />
            </>
          ) : null}

          {isPie ? (
            <>
              <SingleColumnSelect label="Dimensión" value={widget.config.dimension} columns={dimensionColumns} onChange={setSingleDimension} />
              <SingleColumnSelect label="Métrica" value={widget.config.metric} columns={aggregateMetricColumns} onChange={setSingleMetric} />
              <AggregationField value={widget.config.aggregation} onChange={(aggregation) => setConfig({ aggregation })} />
            </>
          ) : null}

          {isCartesian ? (
            <>
              <ColumnList
                label="Dimensiones"
                values={widget.config.dimensions ?? (widget.config.dimension ? [widget.config.dimension] : [])}
                columns={dimensionColumns}
                addLabel="Agregar dimensión"
                onChange={(dimensions) => setConfig({ dimensions, dimension: dimensions[0] })}
              />
              <ColumnList
                label="Métricas"
                values={selectedMetrics}
                columns={aggregateMetricColumns}
                addLabel="Agregar métrica"
                onChange={(metrics) => setConfig({ metrics, metric: metrics[0], aggregation: suggestedAggregation(metrics[0]) })}
              />
              <AggregationField value={widget.config.aggregation} onChange={(aggregation) => setConfig({ aggregation })} />
            </>
          ) : null}

          {showDimensionGrouping ? (
            <>
              <DimensionGroupingField
                mode={widget.config.dimensionGroupingMode ?? "none"}
                limit={widget.config.limit}
                groupRemainingAsOthers={widget.config.groupRemainingAsOthers ?? true}
                showLimitWhenNone={isCartesian}
                onChange={(patch) => setConfig(patch)}
              />
              {isCartesian && (widget.config.dimensionGroupingMode ?? "none") === "none" ? (
                <>
                  <Field label="Orden">
                    <Select value={widget.config.orderDirection ?? "asc"} onValueChange={(value) => setConfig({ orderDirection: value as "asc" | "desc" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="asc">Ascendente</SelectItem><SelectItem value="desc">Descendente</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  <LimitField value={widget.config.limit} onChange={(limit) => setConfig({ limit })} />
                </>
              ) : null}
            </>
          ) : null}

          {(isCartesian || isPie || isTable) ? (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <Label>Filtro cruzado</Label>
                <Switch checked={widget.config.enableCrossFilter ?? true} onCheckedChange={(enableCrossFilter) => setConfig({ enableCrossFilter })} />
              </div>
              <ColumnList
                label="Desglose"
                values={widget.config.drillDimensions ?? []}
                columns={dimensionColumns}
                addLabel="Agregar nivel"
                onChange={(drillDimensions) => setConfig({ drillDimensions, drillLevel: 0, dimension: drillDimensions[0] ?? widget.config.dimension, dimensions: drillDimensions[0] ? [drillDimensions[0]] : widget.config.dimensions })}
              />
              <ColumnList
                label="Métricas opcionales"
                values={(widget.config.optionalMetrics ?? []).map(metricKey)}
                columns={aggregateMetricColumns}
                addLabel="Agregar métrica opcional"
                onChange={(optionalMetrics) => setConfig({ optionalMetrics, activeOptionalMetric: optionalMetrics[0] })}
              />
            </>
          ) : null}

          {isTable && !isPivot ? (
            <>
              <ColumnList
                label="Columnas"
                values={widget.config.dimensions ?? []}
                columns={dimensionColumns}
                addLabel="Agregar columna"
                onChange={(dimensions) => setConfig({ dimensions, dimension: dimensions[0] })}
              />
              <ColumnList
                label="Metricas"
                values={selectedMetrics.filter((metric) => !isRecordCountMetric(metric))}
                columns={metricColumns}
                addLabel="Agregar metrica"
                onChange={(metrics) => setConfig({ metrics, metric: metrics[0], aggregation: suggestedAggregation(metrics[0]) })}
              />
              <LimitField value={widget.config.limit} onChange={(limit) => setConfig({ limit })} />
            </>
          ) : null}

          {isPivot ? (
            <>
              <ColumnList
                label="Filas"
                values={widget.config.dimensions?.slice(0, 1) ?? []}
                columns={dimensionColumns}
                addLabel="Agregar fila"
                onChange={(rows) => setConfig({ dimensions: [rows[0], widget.config.dimensions?.[1]].filter(Boolean) as string[], dimension: rows[0] })}
              />
              <SingleColumnSelect
                label="Columnas"
                value={widget.config.dimensions?.[1]}
                columns={dimensionColumns}
                onChange={(column) => setConfig({ dimensions: [widget.config.dimensions?.[0], column].filter(Boolean) as string[] })}
              />
              <ColumnList
                label="Métricas"
                values={selectedMetrics}
                columns={aggregateMetricColumns}
                addLabel="Agregar métrica"
                onChange={(metrics) => setConfig({ metrics, metric: metrics[0], aggregation: suggestedAggregation(metrics[0]) })}
              />
              <AggregationField value={widget.config.aggregation} onChange={(aggregation) => setConfig({ aggregation })} />
              <LimitField value={widget.config.limit} onChange={(limit) => setConfig({ limit })} />
            </>
          ) : null}

          <Button variant="destructive" className="w-full" onClick={() => removeWidget(widget.id)}><Trash2 className="mr-2 h-4 w-4" />Eliminar componente</Button>
        </TabsContent>

        <TabsContent value="estilo" className="dh-props-panel h-0 min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-contain pb-4">
          {!isText && !isImage ? (
            <>
              <div className="flex items-center justify-between"><Label>Mostrar título</Label><Switch checked={widget.style.showTitle ?? true} onCheckedChange={(showTitle) => setStyle({ showTitle })} /></div>
              <Field label="Título"><Input value={widget.style.title ?? ""} onChange={(event) => setStyle({ title: event.target.value })} /></Field>
            </>
          ) : null}

          <BasicStyleControls style={widget.style} setStyle={setStyle} compact={isImage} />
          {!isImage ? <TypographyStyleControls style={widget.style} setStyle={setStyle} showContentAlign={isScore} /> : null}

          {isPie ? (
            <>
              <div className="flex items-center justify-between"><Label>Leyenda</Label><Switch checked={widget.config.showLegend ?? widget.style.showLegend ?? true} onCheckedChange={(showLegend) => setConfig({ showLegend })} /></div>
              <div className="flex items-center justify-between"><Label>% en torta/dona</Label><Switch checked={widget.style.showPiePercent ?? true} onCheckedChange={(showPiePercent) => setStyle({ showPiePercent })} /></div>
              <ChartAppearanceOptions widget={widget} setConfig={setConfig} compact />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Radio interno"><Input type="number" min={0} max={80} value={widget.style.pieInnerRadius ?? 0} onChange={(event) => setStyle({ pieInnerRadius: Number(event.target.value) })} /></Field>
                <Field label="Radio externo"><Input type="number" min={10} max={90} value={widget.style.pieOuterRadius ?? 58} onChange={(event) => setStyle({ pieOuterRadius: Number(event.target.value) })} /></Field>
              </div>
            </>
          ) : null}

          {isCartesian ? (
            <>
              <div className="flex items-center justify-between"><Label>Leyenda</Label><Switch checked={widget.config.showLegend ?? widget.style.showLegend ?? true} onCheckedChange={(showLegend) => setConfig({ showLegend })} /></div>
              <div className="flex items-center justify-between"><Label>Etiquetas</Label><Switch checked={widget.config.labelShow ?? widget.style.showDataLabels ?? false} onCheckedChange={(labelShow) => setConfig({ labelShow })} /></div>
              <div className="flex items-center justify-between"><Label>Apilar series</Label><Switch checked={widget.config.stack ?? widget.style.stackSeries ?? false} onCheckedChange={(stack) => setConfig({ stack })} /></div>
              <ChartAppearanceOptions widget={widget} setConfig={setConfig} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Grosor de línea"><Input type="number" min={1} max={8} value={widget.style.lineWidth ?? 2} onChange={(event) => setStyle({ lineWidth: Number(event.target.value) })} /></Field>
                <Field label="Radio barra"><Input type="number" min={0} max={12} value={widget.style.barRadius ?? 3} onChange={(event) => setStyle({ barRadius: Number(event.target.value) })} /></Field>
              </div>
            </>
          ) : null}

          {isScatter || isPie || isCartesian ? <SeriesColorControls colors={seriesColors} setStyle={setStyle} /> : null}

          {isTable ? (
            <>
              <div className="flex items-center justify-between"><Label>Mapa de calor</Label><Switch checked={widget.style.showHeatmap ?? false} onCheckedChange={(showHeatmap) => setStyle({ showHeatmap })} /></div>
              {widget.style.showHeatmap ? (
                <Field label="Color mapa de calor">
                  <Input type="color" value={widget.style.heatmapColor ?? "#22c55e"} onChange={(event) => setStyle({ heatmapColor: event.target.value })} />
                </Field>
              ) : null}
            </>
          ) : null}

          <Separator />
          <DataModelControls reportDatasets={report.datasets} dataModel={dataModel} updateDataModel={updateDataModel} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function TypographyStyleControls({
  style,
  setStyle,
  showContentAlign = false,
}: {
  style: WidgetStyle;
  setStyle: (patch: Partial<WidgetStyle>) => void;
  showContentAlign?: boolean;
}) {
  const fontSize = style.fontSize ?? 14;
  const textAlign = style.textAlign ?? "left";
  const contentAlign = style.contentAlign ?? "left";
  const isBold = (style.fontWeight ?? "normal") === "bold";
  const isItalic = (style.fontStyle ?? "normal") === "italic";
  const isUnderline = (style.textDecoration ?? "none") === "underline";

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tamano texto (px)">
          <Input
            type="number"
            min={8}
            max={72}
            value={fontSize}
            onChange={(event) => setStyle({ fontSize: Number(event.target.value) })}
          />
        </Field>
        <Field label="Alinear texto">
          <Select value={textAlign} onValueChange={(value) => setStyle({ textAlign: value as WidgetStyle["textAlign"] })}>
            <SelectTrigger><span>{textAlignLabels[textAlign]}</span></SelectTrigger>
            <SelectContent>
              {Object.entries(textAlignLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {showContentAlign ? (
        <Field label="Alinear bloque">
          <Select value={contentAlign} onValueChange={(value) => setStyle({ contentAlign: value as ContentAlign })}>
            <SelectTrigger><span>{contentAlignLabels[contentAlign]}</span></SelectTrigger>
            <SelectContent>
              {Object.entries(contentAlignLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <Field label="Estilo de texto">
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant={isBold ? "default" : "outline"} className="w-full" onClick={() => setStyle({ fontWeight: isBold ? "normal" : "bold" })}>
            Negrita
          </Button>
          <Button type="button" variant={isItalic ? "default" : "outline"} className="w-full italic" onClick={() => setStyle({ fontStyle: isItalic ? "normal" : "italic" })}>
            Italica
          </Button>
          <Button type="button" variant={isUnderline ? "default" : "outline"} className="w-full underline" onClick={() => setStyle({ textDecoration: isUnderline ? "none" : "underline" })}>
            Subrayado
          </Button>
        </div>
      </Field>
    </>
  );
}

function ChartAppearanceOptions({
  widget,
  setConfig,
  compact = false,
}: {
  widget: ReportWidget;
  setConfig: (patch: Partial<ReportWidget["config"]>) => void;
  compact?: boolean;
}) {
  const legendPosition = widget.config.legendPosition ?? "bottom";
  const legendAlign = widget.config.legendAlign ?? "center";
  const legendLayout = widget.config.legendLayout ?? "auto";
  const valueFormat = widget.config.valueFormat ?? "number";
  const stylePreset = widget.config.stylePreset ?? "modern";

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Leyenda">
          <Select value={legendPosition} onValueChange={(nextLegendPosition) => setConfig({ legendPosition: nextLegendPosition as ReportWidget["config"]["legendPosition"] })}>
            <SelectTrigger><span>{legendPositionLabels[legendPosition]}</span></SelectTrigger>
            <SelectContent>
              {Object.entries(legendPositionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Alinear leyenda">
          <Select value={legendAlign} onValueChange={(nextLegendAlign) => setConfig({ legendAlign: nextLegendAlign as ContentAlign })}>
            <SelectTrigger><span>{contentAlignLabels[legendAlign]}</span></SelectTrigger>
            <SelectContent>
              {Object.entries(contentAlignLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Layout leyenda">
          <Select value={legendLayout} onValueChange={(nextLegendLayout) => setConfig({ legendLayout: nextLegendLayout as LegendLayout })}>
            <SelectTrigger><span>{legendLayoutLabels[legendLayout]}</span></SelectTrigger>
            <SelectContent>
              {Object.entries(legendLayoutLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Formato">
          <Select value={valueFormat} onValueChange={(nextValueFormat) => setConfig({ valueFormat: nextValueFormat as ReportWidget["config"]["valueFormat"] })}>
            <SelectTrigger><span>{valueFormatLabels[valueFormat]}</span></SelectTrigger>
            <SelectContent>
              {Object.entries(valueFormatLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Preset">
        <Select value={stylePreset} onValueChange={(nextStylePreset) => setConfig({ stylePreset: nextStylePreset as ReportWidget["config"]["stylePreset"] })}>
          <SelectTrigger><span>{stylePresetLabels[stylePreset]}</span></SelectTrigger>
          <SelectContent>
            {Object.entries(stylePresetLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      {!compact ? (
        <>
          <div className="flex items-center justify-between"><Label>Grid suave</Label><Switch checked={widget.config.showGrid ?? true} onCheckedChange={(showGrid) => setConfig({ showGrid })} /></div>
          <div className="flex items-center justify-between"><Label>Línea suavizada</Label><Switch checked={widget.config.smooth ?? true} onCheckedChange={(smooth) => setConfig({ smooth })} /></div>
        </>
      ) : null}
    </>
  );
}

function FilterControls({
  title,
  filters,
  columns,
  onChange,
}: {
  title: string;
  filters: WidgetFilter[];
  columns: ColumnOption[];
  onChange: (filters: WidgetFilter[]) => void;
}) {
  const addFilter = () => {
    const column = columns[0];
    if (!column) return;
    onChange([...filters, { column: column.name, operator: "equals", value: "" }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button variant="ghost" size="sm" className="mt-1 h-7 justify-start border border-dashed border-border px-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary" onClick={addFilter} disabled={!columns.length}>
          <Plus className="mr-1.5 h-3 w-3" />
          Filtro
        </Button>
      </div>
      {filters.length === 0 ? <p className="text-xs text-muted-foreground">Sin filtros.</p> : null}
      {filters.map((filter, index) => (
        <div key={`${filter.column}-${index}`} className="space-y-2 rounded-md border border-[var(--dh-border)] p-2">
          <SingleColumnSelect
            label="Campo"
            value={filter.column}
            columns={columns}
            onChange={(column) => {
              const next = [...filters];
              next[index] = { ...filter, column: column ?? filter.column };
              onChange(next);
            }}
          />
          <Select value={filter.operator} onValueChange={(operator) => {
            const next = [...filters];
            next[index] = { ...filter, operator: operator as WidgetFilter["operator"] };
            onChange(next);
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">Igual</SelectItem>
              <SelectItem value="notEquals">Distinto</SelectItem>
              <SelectItem value="contains">Contiene</SelectItem>
              <SelectItem value="notContains">No contiene</SelectItem>
              <SelectItem value="gte">Mayor o igual</SelectItem>
              <SelectItem value="lte">Menor o igual</SelectItem>
              <SelectItem value="isNull">Vacio</SelectItem>
              <SelectItem value="notNull">No vacio</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input value={String(Array.isArray(filter.value) ? filter.value[0] : filter.value ?? "")} onChange={(event) => {
              const next = [...filters];
              next[index] = { ...filter, value: event.target.value };
              onChange(next);
            }} />
            <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => onChange(filters.filter((_, itemIndex) => itemIndex !== index))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function getDimensionColumns(datasets: Dataset[], dataModel: DataModel, baseDatasetId?: string): ColumnOption[] {
  if (!baseDatasetId) return [];
  const baseDataset = datasets.find((dataset) => dataset.id === baseDatasetId);
  const baseColumns = baseDataset ? getVisibleDatasetColumns(baseDataset).map((column) => ({
    name: column.name,
    label: column.label,
    type: column.type,
    defaultAggregation: column.defaultAggregation,
  })) : [];
  const relatedColumns = relatedDatasetsForBase(datasets, dataModel, baseDatasetId).flatMap((relatedDataset) =>
    getVisibleDatasetColumns(relatedDataset).map((column) => ({
      name: `${relatedDataset.id}.${column.name}`,
      label: `${relatedDataset.name}.${column.label}`,
      type: column.type,
      defaultAggregation: column.defaultAggregation,
    })),
  );

  return [...baseColumns, ...relatedColumns];
}

function relatedDatasetsForBase(datasets: Dataset[], dataModel: DataModel, baseDatasetId: string) {
  const datasetById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  const relatedById = new Map<string, Dataset>();

  dataModel.relationships.forEach((relationship) => {
    const relatedDatasetId = relationship.fromDatasetId === baseDatasetId
      ? relationship.toDatasetId
      : relationship.toDatasetId === baseDatasetId ? relationship.fromDatasetId : undefined;

    if (!relatedDatasetId || relatedDatasetId === baseDatasetId) return;
    const relatedDataset = datasetById.get(relatedDatasetId);
    if (relatedDataset) relatedById.set(relatedDataset.id, relatedDataset);
  });

  return Array.from(relatedById.values());
}

function DataModelControls({
  reportDatasets,
  dataModel,
  updateDataModel,
}: {
  reportDatasets: Dataset[];
  dataModel: DataModel;
  updateDataModel: (dataModel: DataModel) => void;
}) {
  const addRelationship = () => {
    const [fromDataset, toDataset] = reportDatasets;
    const { fromColumn, toColumn } = pickRelationshipColumns(fromDataset, toDataset);
    if (!fromDataset || !toDataset || !fromColumn || !toColumn) return;

    updateDataModel({
      relationships: [
        ...dataModel.relationships,
        {
          id: crypto.randomUUID(),
          fromDatasetId: fromDataset.id,
          fromColumn,
          toDatasetId: toDataset.id,
          toColumn,
          cardinality: "many-to-one",
        },
      ],
    });
  };

  const updateRelationship = (id: string, patch: Partial<DatasetRelationship>) => {
    updateDataModel({
      relationships: dataModel.relationships.map((relationship) => (relationship.id === id ? { ...relationship, ...patch } : relationship)),
    });
  };

  const removeRelationship = (id: string) => {
    updateDataModel({ relationships: dataModel.relationships.filter((relationship) => relationship.id !== id) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Modelo de datos</h3>
        <Button variant="ghost" size="sm" className="mt-1 h-7 justify-start border border-dashed border-border px-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary" onClick={addRelationship} disabled={reportDatasets.length < 2}>
          <Plus className="mr-1.5 h-3 w-3" />
          Relación
        </Button>
      </div>
      {dataModel.relationships.length === 0 ? (
        <p className="text-xs text-muted-foreground">Agregá relaciones como ventas.id_producto - productos.id_producto para usar dimensiones relacionadas.</p>
      ) : null}
      {dataModel.relationships.map((relationship) => {
        const fromDataset = reportDatasets.find((dataset) => dataset.id === relationship.fromDatasetId) ?? reportDatasets[0];
        const toDataset = reportDatasets.find((dataset) => dataset.id === relationship.toDatasetId) ?? reportDatasets[1] ?? reportDatasets[0];
        const matchInfo = getRelationshipMatchInfo(fromDataset, toDataset, relationship.fromColumn, relationship.toColumn);

        return (
          <div key={relationship.id} className="space-y-3 rounded-md border border-[var(--dh-border)] bg-card p-3">
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Fuentes</p>
                <DatasetSelect label="Tabla base" datasets={reportDatasets} value={relationship.fromDatasetId} onChange={(fromDatasetId) => {
                  const nextDataset = reportDatasets.find((dataset) => dataset.id === fromDatasetId);
                  const nextColumns = pickRelationshipColumns(nextDataset, toDataset);
                  updateRelationship(relationship.id, { fromDatasetId, fromColumn: nextColumns.fromColumn ?? "" });
                }} />
                <DatasetSelect label="Tabla relacionada" datasets={reportDatasets} value={relationship.toDatasetId} onChange={(toDatasetId) => {
                  const nextDataset = reportDatasets.find((dataset) => dataset.id === toDatasetId);
                  const nextColumns = pickRelationshipColumns(fromDataset, nextDataset);
                  updateRelationship(relationship.id, {
                    toDatasetId,
                    fromColumn: nextColumns.fromColumn ?? relationship.fromColumn,
                    toColumn: nextColumns.toColumn ?? "",
                  });
                }} />
              </div>

              <div className="space-y-2 border-t border-[var(--dh-border)] pt-3">
                <p className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Campos de unión</p>
                <SingleColumnSelect label="ID en base" value={relationship.fromColumn} columns={fromDataset ? getDatasetColumnConfig(fromDataset) : []} onChange={(fromColumn) => updateRelationship(relationship.id, { fromColumn: fromColumn ?? "" })} />
                <SingleColumnSelect label="ID relacionado" value={relationship.toColumn} columns={toDataset ? getDatasetColumnConfig(toDataset) : []} onChange={(toColumn) => updateRelationship(relationship.id, { toColumn: toColumn ?? "" })} />
              </div>
            </div>
            <p className="rounded-md bg-muted px-2 py-1.5 text-[11px] leading-4 text-muted-foreground">
              {fromDataset?.name ?? "Base"}.{relationship.fromColumn || "id"} - {toDataset?.name ?? "Relacionado"}.{relationship.toColumn || "id"}
            </p>
            {matchInfo ? (
              <div className={cn(
                "rounded-md px-2 py-1.5 text-[11px] leading-4",
                matchInfo.matches > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
              )}>
                <p>{matchInfo.matches} de {matchInfo.total} filas con coincidencia.</p>
                {matchInfo.matches === 0 ? (
                  <p>{matchInfo.suggestion ?? "Revisa que ambos campos tengan el mismo ID."}</p>
                ) : null}
              </div>
            ) : null}
            <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => removeRelationship(relationship.id)}>
              Eliminar relación
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function DatasetSelect({ label, datasets, value, onChange }: { label: string; datasets: Dataset[]; value?: string; onChange: (value: string) => void }) {
  const selectedDataset = datasets.find((dataset) => dataset.id === value);

  return (
    <Field label={label}>
      <Select value={value} onValueChange={(next) => {
        if (next) onChange(next);
      }}>
        <SelectTrigger className="w-full min-w-0">
          <span className="truncate text-left">{selectedDataset?.name ?? "Fuente"}</span>
        </SelectTrigger>
        <SelectContent className="min-w-56">{datasets.map((dataset) => <SelectItem key={dataset.id} value={dataset.id}>{dataset.name}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
  );
}

function SingleColumnSelect({
  label,
  value,
  columns,
  onChange,
}: {
  label: string;
  value?: string;
  columns: ColumnOption[];
  onChange: (value?: string) => void;
}) {
  const selectedColumn = columns.find((column) => column.name === value);
  const chipVariant = fieldChipVariant(label);

  return (
    <Field label={label}>
      <div className="space-y-2">
        {selectedColumn ? (
          <FieldChip
            variant={chipVariant}
            label={chipVariant === "metric" ? `↗ ${columnDisplayName(selectedColumn)}` : `⊞ ${columnDisplayName(selectedColumn)}`}
            onRemove={() => onChange(undefined)}
          />
        ) : null}
        <Select value={EMPTY_SELECT_VALUE} onValueChange={(next) => onChange(!next || next === EMPTY_SELECT_VALUE ? undefined : next)}>
          <SelectTrigger className="h-7 w-full min-w-0 justify-start rounded border-dashed border-border bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:border-primary/40 hover:text-primary">
            <Plus className="mr-1.5 h-3 w-3" />
            <span className="truncate text-left">{selectedColumn ? addLabelForField(label) : "Seleccionar"}</span>
          </SelectTrigger>
          <SelectContent className="min-w-56">
            <SelectItem value={EMPTY_SELECT_VALUE}>Sin selección</SelectItem>
            {columns.map((column) => <SelectItem key={column.name} value={column.name}>{columnDisplayName(column)} - {columnTypeLabel(column.type)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </Field>
  );
}

function fieldChipVariant(label: string): "metric" | "dimension" {
  const normalized = normalizeColumnName(label);
  return normalized.includes("metrica") || normalized.includes("métrica") ? "metric" : "dimension";
}

function addLabelForField(label: string) {
  const normalized = normalizeColumnName(label);
  if (normalized.includes("metrica") || normalized.includes("métrica")) return "Agregar métrica";
  if (normalized.includes("dimension") || normalized.includes("dimensión")) return "Agregar dimensión";
  if (normalized.includes("filtro")) return "Agregar campo";
  return `Agregar ${label.toLowerCase()}`;
}

function FieldChip({ variant, label, onRemove }: { variant: "metric" | "dimension"; label: string; onRemove: () => void }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium",
        variant === "metric"
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
      )}
    >
      {label}
      <button type="button" className="ml-0.5 opacity-60 hover:opacity-100" onClick={onRemove}>×</button>
    </span>
  );
}

function ColumnAddSelect({
  addLabel,
  columns,
  onSelect,
}: {
  addLabel: string;
  columns: ColumnOption[];
  onSelect: (value?: string) => void;
}) {
  return (
    <Select value={EMPTY_SELECT_VALUE} onValueChange={(next) => onSelect(!next || next === EMPTY_SELECT_VALUE ? undefined : next)}>
      <SelectTrigger className="mt-1 h-7 w-full min-w-0 justify-start rounded border-dashed border-border bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:border-primary/40 hover:text-primary">
        <Plus className="mr-1.5 h-3 w-3" />
        <span className="truncate text-left">{addLabel}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_SELECT_VALUE}>Sin selección</SelectItem>
        {columns.map((column) => <SelectItem key={column.name} value={column.name}>{column.label ?? column.name} - {columnTypeLabel(column.type)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function columnDisplayName(column?: ColumnOption) {
  return column ? column.label ?? column.name : "Seleccionar";
}

function columnTypeLabel(type: ColumnType) {
  return columnTypeLabels[type] ?? type;
}

function pickRelationshipColumns(fromDataset?: Dataset, toDataset?: Dataset) {
  const fallback = {
    fromColumn: fromDataset?.columns[0]?.name,
    toColumn: toDataset?.columns[0]?.name,
  };
  if (!fromDataset || !toDataset) return fallback;

  const toColumnsByName = new Map(getDatasetColumnConfig(toDataset).map((column) => [normalizeColumnName(column.name), column.name]));
  const matchingFromColumn = getDatasetColumnConfig(fromDataset).find((column) => toColumnsByName.has(normalizeColumnName(column.name)));
  if (!matchingFromColumn) return fallback;

  return {
    fromColumn: matchingFromColumn.name,
    toColumn: toColumnsByName.get(normalizeColumnName(matchingFromColumn.name)) ?? fallback.toColumn,
  };
}

function getRelationshipMatchInfo(fromDataset: Dataset | undefined, toDataset: Dataset | undefined, fromColumn: string, toColumn: string) {
  if (!fromDataset || !toDataset || !fromColumn || !toColumn) return undefined;

  const targetKeys = new Set(toDataset.rows.map((row) => normalizeJoinKey(row[toColumn])).filter(Boolean));
  const matches = fromDataset.rows.filter((row) => targetKeys.has(normalizeJoinKey(row[fromColumn]))).length;
  const suggestion = matches === 0 ? suggestBaseColumn(fromDataset, toDataset, toColumn, fromColumn) : undefined;

  return { matches, total: fromDataset.rows.length, suggestion };
}

function suggestBaseColumn(fromDataset: Dataset, toDataset: Dataset, toColumn: string, currentFromColumn: string) {
  const targetKeys = new Set(toDataset.rows.map((row) => normalizeJoinKey(row[toColumn])).filter(Boolean));
  let bestColumn = "";
  let bestMatches = 0;

  getDatasetColumnConfig(fromDataset).forEach((column) => {
    if (column.name === currentFromColumn) return;
    const matches = fromDataset.rows.filter((row) => targetKeys.has(normalizeJoinKey(row[column.name]))).length;
    if (matches > bestMatches) {
      bestColumn = column.name;
      bestMatches = matches;
    }
  });

  if (!bestColumn || bestMatches === 0) return undefined;
  return `Probá usar ${fromDataset.name}.${bestColumn} como ID en base.`;
}

function normalizeColumnName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeJoinKey(value: unknown) {
  const text = String(value ?? "").trim();
  if (text && !Number.isNaN(Number(text))) return String(Number(text));
  return text;
}

function AggregationField({ value, onChange }: { value: Aggregation; onChange: (value: Aggregation) => void }) {
  return (
    <Field label="Agregación">
      <Select value={value} onValueChange={(next) => onChange(next as Aggregation)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{aggregations.map((item) => <SelectItem key={item} value={item}>{aggregationLabels[item]}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
  );
}

function DimensionGroupingField({
  mode,
  limit,
  groupRemainingAsOthers,
  showLimitWhenNone = true,
  onChange,
}: {
  mode: DimensionGroupingMode;
  limit?: number;
  groupRemainingAsOthers: boolean;
  showLimitWhenNone?: boolean;
  onChange: (patch: Partial<ReportWidget["config"]>) => void;
}) {
  return (
    <>
      <Field label="Mostrar">
        <Select value={mode} onValueChange={(next) => onChange({ dimensionGroupingMode: next as DimensionGroupingMode })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(dimensionGroupingLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      {mode !== "none" || showLimitWhenNone ? (
        <Field label={mode === "none" ? "Limite de filas" : "Numero de porciones"}>
          <Input type="number" min={1} max={500} value={limit ?? 10} onChange={(event) => onChange({ limit: Number(event.target.value) })} />
        </Field>
      ) : null}
      {mode !== "none" ? (
        <div className="flex items-center justify-between">
          <Label>Agrupar resto como Otros</Label>
          <Switch checked={groupRemainingAsOthers} onCheckedChange={(next) => onChange({ groupRemainingAsOthers: next })} />
        </div>
      ) : null}
    </>
  );
}

function LimitField({ value, onChange }: { value?: number; onChange: (value: number) => void }) {
  return (
    <Field label="Límite de filas">
      <Input type="number" value={value ?? 20} onChange={(event) => onChange(Number(event.target.value))} />
    </Field>
  );
}

function BasicStyleControls({
  style,
  setStyle,
  compact = false,
}: {
  style: WidgetStyle;
  setStyle: (patch: Partial<WidgetStyle>) => void;
  compact?: boolean;
}) {
  const backgroundColors = ["#ffffff", "#f1f3f4", "#e8e8ff", "#e8f5e9", "#fff8e1", "#fce4ec", "#3333ff"];

  return (
    <>
      {!compact ? <Field label="Texto"><ColorInput value={style.color ?? "#1f2937"} onChange={(color) => setStyle({ color })} /></Field> : null}
      <Field label="Color de fondo">
        <div className="flex flex-wrap gap-2">
          {backgroundColors.map((color) => (
            <ColorSwatch key={color} color={color} selected={(style.background ?? "#ffffff").toLowerCase() === color.toLowerCase()} onClick={() => setStyle({ background: color })} />
          ))}
        </div>
      </Field>
      <Field label="Bordes">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <span className="text-xs text-foreground">Color de borde</span>
            <ColorInput value={style.borderColor ?? "#d7dce2"} onChange={(borderColor) => setStyle({ borderColor })} square />
          </div>
          {!compact ? (
            <div className="space-y-1.5">
              <span className="text-xs text-foreground">Tamaño</span>
              <Input className="h-8 w-20" type="number" value={style.fontSize ?? 13} onChange={(event) => setStyle({ fontSize: Number(event.target.value) })} />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <span className="text-xs text-foreground">Radio (px)</span>
            <Input className="h-8 w-20" type="number" value={style.borderRadius ?? 4} onChange={(event) => setStyle({ borderRadius: Number(event.target.value) })} />
          </div>
        </div>
      </Field>
    </>
  );
}

function ColorSwatch({ color, selected, onClick }: { color: string; selected?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Color ${color}`}
      className={cn("h-6 w-6 rounded-full border border-border transition-transform hover:scale-110", selected && "ring-2 ring-foreground ring-offset-1")}
      style={{ background: color }}
      onClick={onClick}
    />
  );
}

function ColorInput({ value, onChange, square = false }: { value: string; onChange: (value: string) => void; square?: boolean }) {
  return (
    <Input
      type="color"
      value={value}
      className={cn("h-7 w-7 cursor-pointer p-0", square ? "rounded-sm" : "rounded-full")}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function SeriesColorControls({
  colors,
  setStyle,
}: {
  colors: string[];
  setStyle: (patch: Partial<WidgetStyle>) => void;
}) {
  return (
    <Field label="Colores de series">
      <div className="flex flex-wrap gap-2">
        {colors.slice(0, 6).map((color, index) => (
          <ColorInput
            key={`${index}-${color}`}
            value={color}
            onChange={(nextColor) => {
              const next = [...colors];
              next[index] = nextColor;
              setStyle({ seriesColors: next });
            }}
          />
        ))}
      </div>
    </Field>
  );
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
  columns: ColumnOption[];
  addLabel: string;
  onChange: (values: string[]) => void;
}) {
  const chipVariant = fieldChipVariant(label);

  return (
    <Field label={label}>
      <div className="space-y-2">
        {values.filter(Boolean).length ? (
          <div className="flex flex-wrap gap-1.5">
            {values.filter(Boolean).map((value) => {
              const column = columns.find((item) => item.name === value);
              return (
                <FieldChip
                  key={`${label}-${value}`}
                  variant={chipVariant}
                  label={chipVariant === "metric" ? `↗ ${columnDisplayName(column)}` : `⊞ ${columnDisplayName(column)}`}
                  onRemove={() => onChange(values.filter((item) => item !== value))}
                />
              );
            })}
          </div>
        ) : null}
        <ColumnAddSelect
          addLabel={addLabel}
          columns={columns}
          onSelect={(value) => {
            if (!value) return;
            onChange([...values.filter(Boolean), value]);
          }}
        />
      </div>
    </Field>
  );
}

