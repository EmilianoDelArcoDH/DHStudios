"use client";

import { PanelRightClose, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useEditorStore } from "@/store/editor-store";
import type { Aggregation, ColumnType, Dataset, WidgetMetric, WidgetStyle, WidgetType } from "@/types";
import { aggregationOrFallback, getDatasetColumnConfig, getVisibleDatasetColumns } from "@/lib/dataset";
import { cn } from "@/lib/utils";
import type { DataModel, DatasetRelationship } from "@/lib/data-model/types";

const aggregations: Aggregation[] = ["sum", "avg", "count", "countDistinct", "min", "max"];
const EMPTY_SELECT_VALUE = "__none__";
const defaultSeriesColors = ["#3333ff", "#00cc7e", "#ffc51a", "#ff7059", "#8a6df1", "#ff76e2"];

const cartesianChartTypes: ChartTypeOption[] = [
  { value: "bar", label: "Barra vertical" },
  { value: "horizontal_bar", label: "Barra horizontal" },
  { value: "stacked_bar", label: "Barra apilada" },
  { value: "line", label: "Linea" },
  { value: "multi_line", label: "Multiples lineas" },
  { value: "area", label: "Area" },
  { value: "combo", label: "Combo barra/linea" },
];
const pieChartTypes: ChartTypeOption[] = [
  { value: "pie", label: "Torta" },
  { value: "donut", label: "Dona" },
];
const scatterChartTypes: ChartTypeOption[] = [{ value: "scatter", label: "Dispersion" }];
const tableChartTypes: ChartTypeOption[] = [{ value: "table", label: "Tabla" }];
const scoreChartTypes: ChartTypeOption[] = [
  { value: "kpi", label: "KPI" },
  { value: "scorecard", label: "Scorecard" },
];

const cartesianTypes = new Set(cartesianChartTypes.map((item) => item.value));
const pieTypes = new Set(pieChartTypes.map((item) => item.value));
const scatterTypes = new Set(scatterChartTypes.map((item) => item.value));
const tableTypes = new Set(tableChartTypes.map((item) => item.value));
const scoreTypes = new Set(scoreChartTypes.map((item) => item.value));

type ChartTypeOption = { value: WidgetType; label: string };
type ColumnOption = { name: string; label?: string; type: ColumnType; defaultAggregation?: import("@/types").AggregationType };

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
  const { report, activePageId, selectedWidgetId, updateWidget, removeWidget, updateDataModel } = useEditorStore();
  const page = report.pages.find((item) => item.id === activePageId);
  const widget = page?.widgets.find((item) => item.id === selectedWidgetId);
  const dataset = report.datasets.find((item) => item.id === widget?.config.datasetId);
  const dataModel = report.dataModel ?? { relationships: [] };

  if (!widget) {
    return (
      <aside className="flex h-full w-80 shrink-0 flex-col overflow-hidden border-l border-[var(--dh-border)] bg-card">
        <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
          <h2 className="text-sm font-semibold">Propiedades</h2>
          {onCollapse ? (
            <Button title="Ocultar panel derecho" aria-label="Ocultar panel derecho" variant="ghost" size="icon" className="h-7 w-7" onClick={onCollapse}>
              <PanelRightClose className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          <p className="text-sm text-muted-foreground">No hay componente seleccionado.</p>
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
  const showDataSource = isScore || isScatter || isPie || isCartesian || isTable;

  const setSingleDimension = (dimension?: string) => setConfig({ dimension, dimensions: dimension ? [dimension] : [] });
  const suggestedAggregation = (metric?: string) => aggregationOrFallback(metricColumns.find((column) => column.name === metric)?.defaultAggregation, widget.config.aggregation);
  const setSingleMetric = (metric?: string) => setConfig({ metric, metrics: metric ? [metric] : [], aggregation: suggestedAggregation(metric) });
  const setScatterMetric = (index: number, metric?: string) => {
    const next = [...selectedMetrics];
    if (!metric) next.splice(index, 1);
    else next[index] = metric;
    const cleaned = next.filter(Boolean);
    setConfig({ metric: cleaned[0], metrics: cleaned, aggregation: suggestedAggregation(cleaned[0]) });
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-[var(--dh-border)] bg-card">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">Propiedades</h2>
        {onCollapse ? (
          <Button title="Ocultar panel derecho" aria-label="Ocultar panel derecho" variant="ghost" size="icon" className="h-7 w-7" onClick={onCollapse}>
            <PanelRightClose className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <Tabs defaultValue="datos" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="m-3 grid grid-cols-2 rounded-md bg-[var(--dh-gray-ui)]">
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="estilo">Estilo</TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="h-0 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
          {typeOptions.length > 1 ? (
            <Field label="Tipo de grafico">
              <Select value={widget.type} onValueChange={(value) => updateWidget(widget.id, { type: value as WidgetType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{typeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          ) : null}

          {isText ? (
            <>
              <Field label="Titulo"><Input value={widget.style.title ?? ""} onChange={(event) => setStyle({ title: event.target.value })} /></Field>
              <Field label="Texto"><Input value={widget.style.text ?? ""} onChange={(event) => setStyle({ text: event.target.value })} /></Field>
            </>
          ) : null}

          {isImage ? (
            <Field label="URL de imagen"><Input value={widget.style.imageUrl ?? ""} onChange={(event) => setStyle({ imageUrl: event.target.value })} /></Field>
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

          {isScore ? (
            <>
              <SingleColumnSelect label="Metrica" value={widget.config.metric} columns={metricColumns} onChange={setSingleMetric} />
              <AggregationField value={widget.config.aggregation} onChange={(aggregation) => setConfig({ aggregation })} />
              <Field label="Titulo"><Input value={widget.style.title ?? ""} onChange={(event) => setStyle({ title: event.target.value })} /></Field>
            </>
          ) : null}

          {isScatter ? (
            <>
              <SingleColumnSelect label="Metrica eje X" value={selectedMetrics[0]} columns={metricColumns} onChange={(metric) => setScatterMetric(0, metric)} />
              <SingleColumnSelect label="Metrica eje Y" value={selectedMetrics[1]} columns={metricColumns} onChange={(metric) => setScatterMetric(1, metric)} />
              <LimitField value={widget.config.limit} onChange={(limit) => setConfig({ limit })} />
            </>
          ) : null}

          {isPie ? (
            <>
              <SingleColumnSelect label="Dimension" value={widget.config.dimension} columns={dimensionColumns} onChange={setSingleDimension} />
              <SingleColumnSelect label="Metrica" value={widget.config.metric} columns={metricColumns} onChange={setSingleMetric} />
              <AggregationField value={widget.config.aggregation} onChange={(aggregation) => setConfig({ aggregation })} />
            </>
          ) : null}

          {isCartesian ? (
            <>
              <ColumnList
                label="Dimensiones"
                values={widget.config.dimensions ?? (widget.config.dimension ? [widget.config.dimension] : [])}
                columns={dimensionColumns}
                addLabel="Agregar dimension"
                onChange={(dimensions) => setConfig({ dimensions, dimension: dimensions[0] })}
              />
              <ColumnList
                label="Metricas"
                values={selectedMetrics}
                columns={metricColumns}
                addLabel="Agregar metrica"
                onChange={(metrics) => setConfig({ metrics, metric: metrics[0], aggregation: suggestedAggregation(metrics[0]) })}
              />
              <AggregationField value={widget.config.aggregation} onChange={(aggregation) => setConfig({ aggregation })} />
              <Field label="Orden">
                <Select value={widget.config.orderDirection ?? "asc"} onValueChange={(value) => setConfig({ orderDirection: value as "asc" | "desc" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="asc">Ascendente</SelectItem><SelectItem value="desc">Descendente</SelectItem></SelectContent>
                </Select>
              </Field>
              <LimitField value={widget.config.limit} onChange={(limit) => setConfig({ limit })} />
            </>
          ) : null}

          {isTable ? (
            <>
              <ColumnList
                label="Columnas"
                values={widget.config.dimensions ?? []}
                columns={dimensionColumns}
                addLabel="Agregar columna"
                onChange={(dimensions) => setConfig({ dimensions, dimension: dimensions[0] })}
              />
              <LimitField value={widget.config.limit} onChange={(limit) => setConfig({ limit })} />
            </>
          ) : null}

          <Button variant="destructive" className="w-full" onClick={() => removeWidget(widget.id)}><Trash2 className="mr-2 h-4 w-4" />Eliminar componente</Button>
        </TabsContent>

        <TabsContent value="estilo" className="h-0 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
          {!isText && !isImage && !isScore ? (
            <Field label="Titulo"><Input value={widget.style.title ?? ""} onChange={(event) => setStyle({ title: event.target.value })} /></Field>
          ) : null}

          <BasicStyleControls style={widget.style} setStyle={setStyle} compact={isImage} />

          {isPie ? (
            <>
              <div className="flex items-center justify-between"><Label>Leyenda</Label><Switch checked={widget.style.showLegend ?? true} onCheckedChange={(showLegend) => setStyle({ showLegend })} /></div>
              <div className="flex items-center justify-between"><Label>% en torta/dona</Label><Switch checked={widget.style.showPiePercent ?? false} onCheckedChange={(showPiePercent) => setStyle({ showPiePercent })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Radio interno"><Input type="number" min={0} max={80} value={widget.style.pieInnerRadius ?? 0} onChange={(event) => setStyle({ pieInnerRadius: Number(event.target.value) })} /></Field>
                <Field label="Radio externo"><Input type="number" min={10} max={90} value={widget.style.pieOuterRadius ?? 58} onChange={(event) => setStyle({ pieOuterRadius: Number(event.target.value) })} /></Field>
              </div>
            </>
          ) : null}

          {isCartesian ? (
            <>
              <div className="flex items-center justify-between"><Label>Leyenda</Label><Switch checked={widget.style.showLegend ?? true} onCheckedChange={(showLegend) => setStyle({ showLegend })} /></div>
              <div className="flex items-center justify-between"><Label>Etiquetas</Label><Switch checked={widget.style.showDataLabels ?? false} onCheckedChange={(showDataLabels) => setStyle({ showDataLabels })} /></div>
              <div className="flex items-center justify-between"><Label>Apilar series</Label><Switch checked={widget.style.stackSeries ?? false} onCheckedChange={(stackSeries) => setStyle({ stackSeries })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Grosor linea"><Input type="number" min={1} max={8} value={widget.style.lineWidth ?? 2} onChange={(event) => setStyle({ lineWidth: Number(event.target.value) })} /></Field>
                <Field label="Radio barra"><Input type="number" min={0} max={12} value={widget.style.barRadius ?? 3} onChange={(event) => setStyle({ barRadius: Number(event.target.value) })} /></Field>
              </div>
            </>
          ) : null}

          {isScatter || isPie || isCartesian ? <SeriesColorControls colors={seriesColors} setStyle={setStyle} /> : null}

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
        <Button variant="outline" size="sm" onClick={addRelationship} disabled={reportDatasets.length < 2}>
          <Plus className="mr-2 h-4 w-4" />
          Relacion
        </Button>
      </div>
      {dataModel.relationships.length === 0 ? (
        <p className="text-xs text-muted-foreground">Agrega relaciones como ventas.id_producto - productos.id_producto para usar dimensiones relacionadas.</p>
      ) : null}
      {dataModel.relationships.map((relationship) => {
        const fromDataset = reportDatasets.find((dataset) => dataset.id === relationship.fromDatasetId) ?? reportDatasets[0];
        const toDataset = reportDatasets.find((dataset) => dataset.id === relationship.toDatasetId) ?? reportDatasets[1] ?? reportDatasets[0];
        const matchInfo = getRelationshipMatchInfo(fromDataset, toDataset, relationship.fromColumn, relationship.toColumn);

        return (
          <div key={relationship.id} className="space-y-3 rounded-md border border-[var(--dh-border)] bg-card p-3">
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Datasets</p>
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
                <p className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Campos de union</p>
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
              Eliminar relacion
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
          <span className="truncate text-left">{selectedDataset?.name ?? "Dataset"}</span>
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

  return (
    <Field label={label}>
      <Select value={value ?? EMPTY_SELECT_VALUE} onValueChange={(next) => onChange(!next || next === EMPTY_SELECT_VALUE ? undefined : next)}>
        <SelectTrigger className="w-full min-w-0">
          <span className="truncate text-left">{selectedColumn ? columnDisplayName(selectedColumn) : "Sin seleccion"}</span>
        </SelectTrigger>
        <SelectContent className="min-w-56">
          <SelectItem value={EMPTY_SELECT_VALUE}>Sin seleccion</SelectItem>
          {columns.map((column) => <SelectItem key={column.name} value={column.name}>{columnDisplayName(column)} - {column.type}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );
}

function columnDisplayName(column?: ColumnOption) {
  return column ? column.label ?? column.name : "Seleccionar";
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
  return `Proba usar ${fromDataset.name}.${bestColumn} como ID en base.`;
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
    <Field label="Agregacion">
      <Select value={value} onValueChange={(next) => onChange(next as Aggregation)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{aggregations.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
  );
}

function LimitField({ value, onChange }: { value?: number; onChange: (value: number) => void }) {
  return (
    <Field label="Limite de filas">
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
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {!compact ? <Field label="Texto"><Input type="color" value={style.color ?? "#1f2937"} onChange={(event) => setStyle({ color: event.target.value })} /></Field> : null}
        <Field label="Fondo"><Input type="color" value={style.background ?? "#ffffff"} onChange={(event) => setStyle({ background: event.target.value })} /></Field>
        <Field label="Borde"><Input type="color" value={style.borderColor ?? "#d7dce2"} onChange={(event) => setStyle({ borderColor: event.target.value })} /></Field>
        {!compact ? <Field label="Tamano"><Input type="number" value={style.fontSize ?? 13} onChange={(event) => setStyle({ fontSize: Number(event.target.value) })} /></Field> : null}
      </div>
      <Field label="Radio de borde"><Input type="number" value={style.borderRadius ?? 4} onChange={(event) => setStyle({ borderRadius: Number(event.target.value) })} /></Field>
    </>
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
      <div className="grid grid-cols-6 gap-2">
        {colors.slice(0, 6).map((color, index) => (
          <Input
            key={`${index}-${color}`}
            type="color"
            value={color}
            onChange={(event) => {
              const next = [...colors];
              next[index] = event.target.value;
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
              <SelectTrigger className="w-full min-w-0">
                <span className="truncate text-left">{columnDisplayName(columns.find((column) => column.name === value))}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>Sin seleccion</SelectItem>
                {columns.map((column) => <SelectItem key={column.name} value={column.name}>{column.label ?? column.name} - {column.type}</SelectItem>)}
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

