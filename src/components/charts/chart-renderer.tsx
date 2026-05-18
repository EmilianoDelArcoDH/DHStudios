"use client";

import dynamic from "next/dynamic";
import { Component, memo, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ChartConfig, ColumnFormat, Dataset, DatasetColumnConfig, DatasetRow, ReportWidget, WidgetFilter, WidgetMetric } from "@/types";
import { aggregate, applyCalculatedFields, applyFilters, getDatasetColumnConfig, getVisibleDatasetColumns } from "@/lib/dataset";
import { executeWidgetQuery, queryFieldFromKey } from "@/lib/data-model/query";
import type { DataModel } from "@/lib/data-model/types";
import { useEditorStore } from "@/store/editor-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useChartOptions } from "./use-chart-options";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <ChartLoadingState label="Cargando gráfico..." />,
});

type Props = {
  widget: ReportWidget;
  dataset?: Dataset;
  datasets?: Dataset[];
  dataModel?: DataModel;
  globalFilters?: WidgetFilter[];
};

function activeDimensions(config: ChartConfig) {
  const drillDimensions = config.drillDimensions?.filter(Boolean) ?? [];
  if (drillDimensions.length) {
    return [drillDimensions[Math.min(config.drillLevel ?? 0, drillDimensions.length - 1)]];
  }
  const dimensions = config.dimensions?.filter(Boolean) ?? [];
  return dimensions.length ? dimensions : config.dimension ? [config.dimension] : [];
}

function activeMetricConfigs(config: ChartConfig): WidgetMetric[] {
  const metrics = config.metrics?.filter(Boolean).map((metric) => (
    typeof metric === "string"
      ? { id: metric, column: metric, label: metric, aggregation: config.aggregation }
      : metric
  )) ?? [];
  const activeOptionalMetric = config.activeOptionalMetric;
  if (activeOptionalMetric) {
    const optional = (config.optionalMetrics ?? []).find((metric) => metricKey(metric) === activeOptionalMetric);
    if (optional) return [typeof optional === "string" ? { id: optional, column: optional, label: optional, aggregation: config.aggregation } : optional];
  }
  return metrics.length ? metrics : config.metric ? [{ id: config.metric, column: config.metric, label: config.metric, aggregation: config.aggregation }] : [];
}

function metricKey(metric: string | WidgetMetric) {
  return typeof metric === "string" ? metric : metric.column ?? metric.id;
}

function activeMetrics(config: ChartConfig) {
  return activeMetricConfigs(config).map((metric) => metric.column ?? metric.id);
}

function rowLabel(row: DatasetRow, dimensions: string[]) {
  if (!dimensions.length) return "Total";
  return dimensions.map((dimension) => String(row[dimension] ?? "Sin valor")).join(" · ");
}

function buildChartData(dataset: Dataset | undefined, config: ChartConfig) {
  const dimensions = activeDimensions(config);
  const columnConfigByName = new Map(dataset ? getDatasetColumnConfig(dataset).map((column) => [column.name, column]) : []);
  const metricConfigs = activeMetricConfigs(config).map((metric) => {
    const column = columnConfigByName.get(metric.column ?? metric.id);
    return { ...metric, label: column?.label ?? metric.label };
  });
  const metrics = metricConfigs.map((metric) => metric.column ?? metric.id);
  if (!dataset) return { dimensions, metrics, categories: [], series: [] as { name: string; data: number[] }[], rows: [] as DatasetRow[] };

  const rowsWithCalculatedFields = applyCalculatedFields(dataset.rows, [...(dataset.calculatedFields ?? []), ...(config.calculatedFields ?? [])]);
  const rows = applyFilters(rowsWithCalculatedFields, [...(config.globalFilters ?? []), ...(config.filters ?? [])]);
  const groups = new Map<string, DatasetRow[]>();
  rows.forEach((row) => {
    const label = rowLabel(row, dimensions);
    groups.set(label, [...(groups.get(label) ?? []), row]);
  });

  const categories = Array.from(groups.keys()).slice(0, config.limit ?? 50);
  const series = (metricConfigs.length ? metricConfigs : [{ id: "registros", label: "registros", aggregation: "count" as const }]).map((metric) => ({
    name: metric.label,
    data: categories.map((category) => {
      const groupedRows = groups.get(category) ?? [];
      const values = metric.column ? groupedRows.map((row) => row[metric.column!]) : groupedRows.map(() => 1);
      return aggregate(values, metric.aggregation);
    }),
  }));

  if (config.orderDirection === "desc" && series[0]) {
    const zipped = categories.map((category, index) => ({ category, index, value: series[0].data[index] ?? 0 }));
    zipped.sort((a, b) => b.value - a.value);
    return {
      dimensions,
      metrics,
      rows,
      categories: zipped.map((item) => item.category),
      series: series.map((item) => ({ ...item, data: zipped.map((zippedItem) => item.data[zippedItem.index] ?? 0) })),
    };
  }

  return { dimensions, metrics, rows, categories, series };
}

function validateWidget(dataset: Dataset | undefined, config: ChartConfig) {
  if (!dataset) return "Seleccioná una fuente de datos.";
  const columns = new Set(getDatasetColumnConfig(dataset).map((column) => column.name));
  const missingDimension = activeDimensions(config).find((dimension) => !columns.has(dimension));
  const missingMetric = activeMetrics(config).find((metric) => metric && !columns.has(metric));
  if (missingDimension) return `La dimensión no es válida: ${readableColumnName(missingDimension)}.`;
  if (missingMetric) return `La métrica no es válida: ${readableColumnName(missingMetric)}.`;
  return "";
}

function buildModelChartData(datasets: Dataset[] | undefined, dataModel: DataModel | undefined, config: ChartConfig) {
  const baseDatasetId = config.baseDatasetId ?? config.datasetId;
  if (!baseDatasetId || !datasets?.length) return undefined;

  const dimensions = activeDimensions(config).map((key) => queryFieldFromKey(key, baseDatasetId));
  const metrics = activeMetrics(config).map((key) => queryFieldFromKey(key, baseDatasetId));
  const hasModelField = [...dimensions, ...metrics].some((field) => field.datasetId !== baseDatasetId);
  if (!hasModelField && !dataModel?.relationships.length) return undefined;

  return executeWidgetQuery(
    {
      baseDatasetId,
      dimensions,
      metrics,
      aggregation: config.aggregation,
      limit: config.limit,
      orderDirection: config.orderDirection,
    },
    datasets,
    dataModel,
  );
}

function ChartRendererBase({ widget, dataset, datasets, dataModel, globalFilters = [] }: Props) {
  const setInteractionFilter = useEditorStore((state) => state.setInteractionFilter);
  const interactionFilter = useEditorStore((state) => state.interactionFilters[widget.id]);
  const updateWidget = useEditorStore((state) => state.updateWidget);
  const effectiveConfig = useMemo(() => ({ ...widget.config, globalFilters }), [globalFilters, widget.config]);
  const chartData = useMemo(
    () => buildModelChartData(datasets, dataModel, effectiveConfig) ?? buildChartData(dataset, effectiveConfig),
    [dataModel, dataset, datasets, effectiveConfig],
  );
  const option = useChartOptions({ widget, chartData });

  if (widget.type === "text") {
    return <div className="whitespace-pre-wrap p-3 text-sm" style={{ color: widget.style.color }}>{widget.style.text}</div>;
  }

  if (widget.type === "image") {
    return widget.style.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={widget.style.imageUrl} alt={widget.style.title ?? "Imagen"} className="h-full w-full object-cover" />
    ) : <EmptyWidget label="Agregá una URL de imagen" />;
  }

  if (widget.type.startsWith("control")) {
    return <ControlWidget widget={widget} dataset={dataset} />;
  }

  if (!dataset) return <EmptyWidget label="Seleccioná una fuente de datos" />;

  const validationMessage = validateWidget(dataset, widget.config);
  if (validationMessage) return <InvalidWidget label={validationMessage} />;

  const handleCategoryClick = (category: string) => {
    const dimension = activeDimensions(widget.config)[0];
    if (!dimension || !widget.config.enableCrossFilter) return;
    const current = interactionFilter?.operator === "equals" ? String(interactionFilter.value) : "";
    setInteractionFilter(widget.id, current === category ? undefined : { column: dimension, operator: "equals", value: category });
  };

  const drillDown = () => {
    const drillDimensions = widget.config.drillDimensions ?? [];
    const nextLevel = Math.min((widget.config.drillLevel ?? 0) + 1, drillDimensions.length - 1);
    if (drillDimensions.length > 1 && nextLevel !== (widget.config.drillLevel ?? 0)) {
      updateWidget(widget.id, { config: { ...widget.config, drillLevel: nextLevel, dimension: drillDimensions[nextLevel], dimensions: [drillDimensions[nextLevel]] } });
    }
  };

  const resetDrill = () => {
    const first = widget.config.drillDimensions?.[0];
    updateWidget(widget.id, { config: { ...widget.config, drillLevel: 0, dimension: first ?? widget.config.dimension, dimensions: first ? [first] : widget.config.dimensions } });
  };

  if (widget.type === "table") {
    const selectedColumns = activeDimensions(widget.config);
    const fallbackColumns = getVisibleDatasetColumns(dataset).map((column) => column.name);
    return (
      <DataTable
        rows={chartData.rows}
        columnKeys={selectedColumns.length ? selectedColumns : fallbackColumns}
        columnConfigs={getDatasetColumnConfig(dataset)}
        limit={widget.config.limit ?? 20}
        onRowClick={(row) => {
          const dimension = activeDimensions(widget.config)[0] ?? selectedColumns[0];
          const value = dimension ? row[dimension] : undefined;
          if (value !== undefined && value !== null) handleCategoryClick(String(value));
        }}
      />
    );
  }

  if (widget.type === "pivot_table") {
    const [rowDimension, columnDimension] = widget.config.dimensions ?? [];
    return (
      <PivotTable
        rows={chartData.rows}
        rowDimension={rowDimension}
        columnDimension={columnDimension}
        metric={activeMetricConfigs(widget.config)[0]}
        columnConfigs={getDatasetColumnConfig(dataset)}
        aggregation={widget.config.aggregation}
        limit={widget.config.limit ?? 20}
      />
    );
  }

  if (widget.type === "kpi" || widget.type === "scorecard") {
    const value = chartData.series[0]?.data[0] ?? 0;
    const metricConfig = getDatasetColumnConfig(dataset).find((column) => column.name === widget.config.metric);
    const showTitle = widget.style.showTitle ?? true;
    return (
      <div className="flex h-full flex-col justify-center px-4">
        {showTitle ? <span className="text-xs text-muted-foreground">{widget.style.title}</span> : null}
        <strong className="font-mono text-3xl tracking-normal">{formatValue(value, metricConfig?.format)}</strong>
        <span className="text-xs text-muted-foreground">{widget.config.aggregation} de {metricConfig?.label ?? widget.config.metric ?? "registros"}</span>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <ChartQuickActions
        widget={widget}
        dataset={dataset}
        interactionFilter={interactionFilter}
        onMetricChange={(metric) => updateWidget(widget.id, { config: { ...widget.config, activeOptionalMetric: metric } })}
        onDrillDown={drillDown}
        onResetDrill={resetDrill}
        onClearInteractionFilter={() => setInteractionFilter(widget.id, undefined)}
      />
      <WidgetChartBoundary>
        <MeasuredChart option={option} onCategoryClick={handleCategoryClick} />
      </WidgetChartBoundary>
    </div>
  );
}

class WidgetChartBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Chart widget render failed", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return <InvalidWidget label="No se pudo renderizar este gráfico." />;
    return this.props.children;
  }
}

function MeasuredChart({ option, onCategoryClick }: { option: object; onCategoryClick?: (category: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartResizeObserverRef = useRef<ResizeObserver | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize((current) => {
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        if (current.width === width && current.height === height) return current;
        if (Math.abs(current.width - width) < 2 && Math.abs(current.height - height) < 2) return current;
        return { width, height };
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => chartResizeObserverRef.current?.disconnect(), []);

  const handleChartReady = useCallback((chart: { resize: () => void }) => {
    chartResizeObserverRef.current?.disconnect();
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    chartResizeObserverRef.current = observer;
    chart.resize();
  }, []);

  const ready = size.width > 8 && size.height > 8;

  return (
    <div ref={ref} className="chart-container h-full min-h-[320px] w-full min-w-0">
      {ready ? (
        <ReactECharts
          option={option}
          onEvents={{ click: (params: { name?: string }) => params.name ? onCategoryClick?.(String(params.name)) : undefined }}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "svg" }}
          onChartReady={handleChartReady}
          notMerge
          lazyUpdate
          autoResize
        />
      ) : (
        <ChartLoadingState label="Preparando gráfico..." />
      )}
    </div>
  );
}

function DataTable({ rows, columnKeys, columnConfigs, limit, onRowClick }: { rows: DatasetRow[]; columnKeys: string[]; columnConfigs: DatasetColumnConfig[]; limit: number; onRowClick?: (row: DatasetRow) => void }) {
  const configByName = useMemo(() => new Map(columnConfigs.map((column) => [column.name, column])), [columnConfigs]);
  const columns = useMemo(
    () => columnKeys.map((column) => ({
      id: column,
      accessorFn: (row: DatasetRow) => row[column],
      header: configByName.get(column)?.label ?? readableColumnName(column),
      cell: (info: { getValue: () => unknown }) => formatValue(info.getValue(), configByName.get(column)?.format),
    })),
    [columnKeys, configByName],
  );
  const data = useMemo(() => rows.slice(0, limit), [rows, limit]);
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className={onRowClick ? "cursor-pointer" : undefined} onClick={() => onRowClick?.(row.original)}>
              {row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function readableColumnName(column: string) {
  const separator = column.indexOf(".");
  return separator === -1 ? column : column.slice(separator + 1);
}

function ChartQuickActions({
  widget,
  dataset,
  interactionFilter,
  onMetricChange,
  onDrillDown,
  onResetDrill,
  onClearInteractionFilter,
}: {
  widget: ReportWidget;
  dataset?: Dataset;
  interactionFilter?: WidgetFilter;
  onMetricChange: (metric?: string) => void;
  onDrillDown: () => void;
  onResetDrill: () => void;
  onClearInteractionFilter: () => void;
}) {
  const optionalMetrics = widget.config.optionalMetrics ?? [];
  const drillDimensions = widget.config.drillDimensions ?? [];
  const metricOptions = optionalMetrics.map((metric) => {
    const key = metricKey(metric);
    const columnLabel = dataset ? getDatasetColumnConfig(dataset).find((column) => column.name === key)?.label : undefined;
    return { key, label: typeof metric === "string" ? columnLabel ?? metric : metric.label };
  });

  // const exportCsv = () => downloadCsv(`${widget.style.title ?? "grafico"}.csv`, chartDataToCsv(chartData));

  // if (!metricOptions.length && drillDimensions.length <= 1) {
  //   return (
  //     <div className="absolute right-2 top-2 z-10">
  //       <Button variant="outline" size="sm" className="h-7 bg-card/95 px-2 text-xs" onClick={exportCsv}>CSV</Button>
  //     </div>
  //   );
  // }

  return (
    <div className="absolute right-2 top-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-1">
      {interactionFilter ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 max-w-44 bg-card/95 px-2 text-xs shadow-sm"
          title={`Filtro activo: ${String(interactionFilter.value)}`}
          onClick={(event) => {
            event.stopPropagation();
            onClearInteractionFilter();
          }}
        >
          <span className="truncate">Ver total</span>
        </Button>
      ) : null}
      {metricOptions.length ? (
        <Select value={widget.config.activeOptionalMetric ?? ""} onValueChange={(value) => onMetricChange(value || undefined)}>
          <SelectTrigger className="h-7 w-32 bg-card/95 px-2 text-xs shadow-sm">
            <SelectValue placeholder="Métrica" />
          </SelectTrigger>
          <SelectContent>
            {metricOptions.map((metric) => <SelectItem key={metric.key} value={metric.key}>{metric.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : null}
      {drillDimensions.length > 1 ? (
        <>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onDrillDown}>Desglosar</Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onResetDrill}>Reiniciar</Button>
        </>
      ) : null}
      {/* <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={exportCsv}>CSV</Button> */}
    </div>
  );
}

function PivotTable({
  rows,
  rowDimension,
  columnDimension,
  metric,
  columnConfigs,
  aggregation,
  limit,
}: {
  rows: DatasetRow[];
  rowDimension?: string;
  columnDimension?: string;
  metric?: WidgetMetric;
  columnConfigs: DatasetColumnConfig[];
  aggregation: WidgetMetric["aggregation"];
  limit: number;
}) {
  if (!rowDimension || !columnDimension) return <InvalidWidget label="Configura filas y columnas para la tabla dinámica." />;
  const rowLabels = Array.from(new Set(rows.map((row) => String(row[rowDimension] ?? "Sin valor")))).slice(0, limit);
  const columnLabels = Array.from(new Set(rows.map((row) => String(row[columnDimension] ?? "Sin valor")))).slice(0, 30);
  const metricColumn = metric?.column ?? metric?.id;
  const metricConfig = columnConfigs.find((column) => column.name === metricColumn);

  const cellValue = (rowLabelValue: string, columnLabelValue: string) => {
    const grouped = rows.filter((row) => String(row[rowDimension] ?? "Sin valor") === rowLabelValue && String(row[columnDimension] ?? "Sin valor") === columnLabelValue);
    return aggregate(metricColumn ? grouped.map((row) => row[metricColumn]) : grouped.map(() => 1), metric?.aggregation ?? aggregation);
  };

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{columnConfigs.find((column) => column.name === rowDimension)?.label ?? rowDimension}</TableHead>
            {columnLabels.map((label) => <TableHead key={label} className="text-right">{label}</TableHead>)}
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rowLabels.map((rowLabelValue) => {
            const values = columnLabels.map((columnLabelValue) => cellValue(rowLabelValue, columnLabelValue));
            return (
              <TableRow key={rowLabelValue}>
                <TableCell className="font-medium">{rowLabelValue}</TableCell>
                {values.map((value, index) => <TableCell key={`${rowLabelValue}-${columnLabels[index]}`} className="text-right">{formatValue(value, metricConfig?.format ?? "number")}</TableCell>)}
                <TableCell className="text-right font-semibold">{formatValue(values.reduce((sum, value) => sum + value, 0), metricConfig?.format ?? "number")}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ControlWidget({ widget, dataset }: { widget: ReportWidget; dataset?: Dataset }) {
  const value = useEditorStore((state) => state.controlValues[widget.id]);
  const setControlValue = useEditorStore((state) => state.setControlValue);
  const column = widget.config.dimension;
  const label = dataset && column
    ? getDatasetColumnConfig(dataset).find((item) => item.name === column)?.label ?? column
    : "Campo";
  const showTitle = widget.style.showTitle ?? true;

  if (!dataset) return <EmptyWidget label="Seleccioná una fuente de datos" />;
  if (!column) return <EmptyWidget label="Seleccioná un campo de filtro" />;

  if (widget.type === "control_select") {
    const options = uniqueColumnValues(dataset, column);
    const selectedValue = typeof value === "string" ? value : "";
    return (
      <div className="flex h-full flex-col justify-center gap-2 p-3">
        {showTitle ? <span className="text-xs font-medium text-muted-foreground">{widget.style.title || label}</span> : null}
        <Select value={selectedValue || "__all__"} onValueChange={(next) => setControlValue(widget.id, !next || next === "__all__" ? undefined : next)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (widget.type === "control_date") {
    const range = Array.isArray(value) ? value : ["", ""];
    return (
      <div className="flex h-full flex-col justify-center gap-2 p-3">
        {showTitle ? <span className="text-xs font-medium text-muted-foreground">{widget.style.title || label}</span> : null}
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={range[0]} onChange={(event) => setControlValue(widget.id, [event.target.value, range[1]])} />
          <Input type="date" value={range[1]} onChange={(event) => setControlValue(widget.id, [range[0], event.target.value])} />
        </div>
        <Button variant="ghost" size="sm" onClick={() => setControlValue(widget.id, undefined)}>Limpiar</Button>
      </div>
    );
  }

  const textValue = typeof value === "string" ? value : "";
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-3">
      {showTitle ? <span className="text-xs font-medium text-muted-foreground">{widget.style.title || label}</span> : null}
      <Input value={textValue} onChange={(event) => setControlValue(widget.id, event.target.value ? event.target.value : undefined)} placeholder="Filtrar..." />
    </div>
  );
}

function uniqueColumnValues(dataset: Dataset, column: string) {
  return Array.from(new Set(dataset.rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== "").map(String))).sort((a, b) => a.localeCompare(b));
}

function formatValue(value: unknown, format: ColumnFormat = "text") {
  if (value === null || value === undefined || value === "") return "";
  if (format === "currency") return Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value));
  if (format === "percent") return Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 1 }).format(Number(value));
  if (format === "number") return Intl.NumberFormat("es-AR").format(Number(value));
  if (format === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("es-AR");
  }
  return String(value);
}

function EmptyWidget({ label }: { label: string }) {
  return <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">{label}</div>;
}

function ChartLoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
      <div className="grid h-10 w-10 grid-cols-3 items-end gap-1 rounded-md border border-border bg-card p-2 shadow-sm">
        <span className="h-3 rounded-sm bg-primary/35" />
        <span className="h-5 rounded-sm bg-primary/55" />
        <span className="h-7 rounded-sm bg-primary/75" />
      </div>
      <span>{label}</span>
    </div>
  );
}

function InvalidWidget({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
      <div className="font-mono text-lg">!</div>
      <div className="text-sm font-semibold text-foreground">Configuración no válida</div>
      <div className="max-w-xs text-xs">{label}</div>
    </div>
  );
}

export const ChartRenderer = memo(ChartRendererBase);
