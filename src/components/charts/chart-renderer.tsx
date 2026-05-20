"use client";

import dynamic from "next/dynamic";
import { Component, memo, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ChartConfig, ColumnFormat, Dataset, DatasetColumnConfig, DatasetRow, ReportWidget, WidgetFilter, WidgetMetric } from "@/types";
import { aggregate, applyCalculatedFields, applyFilters, getDatasetColumnConfig, getVisibleDatasetColumns, isRecordCountMetric, RECORD_COUNT_LABEL, RECORD_COUNT_METRIC } from "@/lib/dataset";
import { executeWidgetQuery, queryFieldFromKey } from "@/lib/data-model/query";
import type { DataModel } from "@/lib/data-model/types";
import { useEditorStore } from "@/store/editor-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useChartOptions } from "./use-chart-options";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <ChartLoadingState label="Cargando gráfico..." />,
});

const GROUPED_OTHERS_LABEL = "Otros";

function textStyleFromWidget(widget: ReportWidget) {
  return {
    color: widget.style.color,
    fontFamily: widget.style.fontFamily,
    fontSize: widget.style.fontSize ? `${widget.style.fontSize}px` : undefined,
    fontWeight: widget.style.fontWeight ?? "normal",
    fontStyle: widget.style.fontStyle ?? "normal",
    textDecoration: widget.style.textDecoration ?? "none",
    textAlign: widget.style.textAlign ?? "left",
  } as const;
}

type Props = {
  widget: ReportWidget;
  dataset?: Dataset;
  datasets?: Dataset[];
  dataModel?: DataModel;
  globalFilters?: WidgetFilter[];
  onClearInteractionFilters?: () => void;
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
  const recordCountMetric: WidgetMetric = { id: RECORD_COUNT_METRIC, label: RECORD_COUNT_LABEL, aggregation: "count" };
  const metrics = config.metrics?.filter(Boolean).map((metric) => (
    typeof metric === "string"
      ? isRecordCountMetric(metric)
        ? recordCountMetric
        : { id: metric, column: metric, label: metric, aggregation: config.aggregation }
      : metric
  )) ?? [];
  const activeOptionalMetric = config.activeOptionalMetric;
  if (activeOptionalMetric) {
    const optional = (config.optionalMetrics ?? []).find((metric) => metricKey(metric) === activeOptionalMetric);
    if (optional) {
      return [typeof optional === "string"
        ? isRecordCountMetric(optional)
          ? recordCountMetric
          : { id: optional, column: optional, label: optional, aggregation: config.aggregation }
        : optional];
    }
  }
  if (metrics.length) return metrics;
  if (!config.metric) return [];
  return isRecordCountMetric(config.metric)
    ? [recordCountMetric]
    : [{ id: config.metric, column: config.metric, label: config.metric, aggregation: config.aggregation }];
}

function metricKey(metric: string | WidgetMetric) {
  return typeof metric === "string" ? metric : metric.column ?? metric.id;
}

function activeMetrics(config: ChartConfig) {
  return activeMetricConfigs(config).map((metric) => metric.column ?? metric.id);
}

function applyDimensionGrouping(
  categories: string[],
  series: { name: string; data: number[] }[],
  config: ChartConfig,
) {
  const limit = config.limit ?? 50;
  if (!categories.length || !series.length) {
    return {
      categories: categories.slice(0, limit),
      series: series.map((item) => ({ ...item, data: item.data.slice(0, limit) })),
    };
  }

  const groupingMode = config.dimensionGroupingMode ?? "none";
  if (groupingMode === "top_n" || groupingMode === "bottom_n") {
    const zipped = categories.map((category, index) => ({ category, index, value: series[0]?.data[index] ?? 0 }));
    zipped.sort((a, b) => groupingMode === "top_n" ? b.value - a.value : a.value - b.value);

    const selected = zipped.slice(0, limit);
    const remainder = zipped.slice(limit);
    const groupedCategories = selected.map((item) => item.category);
    const groupedSeries = series.map((item) => ({
      ...item,
      data: selected.map((selectedItem) => item.data[selectedItem.index] ?? 0),
    }));

    if (config.groupRemainingAsOthers && remainder.length) {
      groupedCategories.push(GROUPED_OTHERS_LABEL);
      groupedSeries.forEach((item, seriesIndex) => {
        const othersValue = remainder.reduce((sum, remainderItem) => sum + Number(series[seriesIndex]?.data[remainderItem.index] ?? 0), 0);
        item.data.push(othersValue);
      });
    }

    return { categories: groupedCategories, series: groupedSeries };
  }

  const slicedCategories = categories.slice(0, limit);
  const slicedSeries = series.map((item) => ({ ...item, data: item.data.slice(0, limit) }));
  if (config.orderDirection === "desc" && slicedSeries[0]) {
    const zipped = slicedCategories.map((category, index) => ({ category, index, value: slicedSeries[0].data[index] ?? 0 }));
    zipped.sort((a, b) => b.value - a.value);
    return {
      categories: zipped.map((item) => item.category),
      series: slicedSeries.map((item) => ({ ...item, data: zipped.map((zippedItem) => item.data[zippedItem.index] ?? 0) })),
    };
  }

  return { categories: slicedCategories, series: slicedSeries };
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

  const categories = Array.from(groups.keys());
  const series = (metricConfigs.length ? metricConfigs : [{ id: RECORD_COUNT_METRIC, label: RECORD_COUNT_LABEL, aggregation: "count" as const }]).map((metric) => ({
    name: metric.label,
    data: categories.map((category) => {
      const groupedRows = groups.get(category) ?? [];
      const values = metric.column ? groupedRows.map((row) => row[metric.column!]) : groupedRows.map(() => 1);
      return aggregate(values, metric.aggregation);
    }),
  }));

  const grouped = applyDimensionGrouping(categories, series, config);
  return { dimensions, metrics, rows, categories: grouped.categories, series: grouped.series };
}

function validateWidget(dataset: Dataset | undefined, config: ChartConfig) {
  if (!dataset) return "Seleccioná una fuente de datos.";
  const columns = new Set(getDatasetColumnConfig(dataset).map((column) => column.name));
  const missingDimension = activeDimensions(config).find((dimension) => !columns.has(dimension));
  const missingMetric = activeMetrics(config).find((metric) => metric && !isRecordCountMetric(metric) && !columns.has(metric));
  if (missingDimension) return `La dimensión no es válida: ${readableColumnName(missingDimension)}.`;
  if (missingMetric) return `La métrica no es válida: ${readableColumnName(missingMetric)}.`;
  return "";
}

function buildModelChartData(datasets: Dataset[] | undefined, dataModel: DataModel | undefined, config: ChartConfig) {
  const baseDatasetId = config.baseDatasetId ?? config.datasetId;
  if (!baseDatasetId || !datasets?.length) return undefined;

  const dimensions = activeDimensions(config).map((key) => queryFieldFromKey(key, baseDatasetId));
  const metricConfigs = activeMetricConfigs(config);
  const metrics = metricConfigs.map((metric) => queryFieldFromKey(metric.column ?? metric.id, baseDatasetId));
  const hasModelField = [...dimensions, ...metrics].some((field) => field.datasetId !== baseDatasetId);
  if (!hasModelField && !dataModel?.relationships.length) return undefined;

  const result = executeWidgetQuery(
    {
      baseDatasetId,
      dimensions,
      metrics,
      aggregation: config.aggregation,
    },
    datasets,
    dataModel,
  );
  const grouped = applyDimensionGrouping(result.categories, result.series, config);

  return {
    ...result,
    metrics: metricConfigs.map((metric) => metric.column ?? metric.id),
    categories: grouped.categories,
    series: grouped.series.map((series, index) => ({ ...series, name: metricConfigs[index]?.label ?? series.name })),
  };
}

function ChartRendererBase({ widget, dataset, datasets, dataModel, globalFilters = [], onClearInteractionFilters }: Props) {
  const setInteractionFilter = useEditorStore((state) => state.setInteractionFilter);
  const interactionFilter = useEditorStore((state) => state.interactionFilters[widget.id]);
  const updateWidget = useEditorStore((state) => state.updateWidget);
  const effectiveConfig = useMemo(() => ({ ...widget.config, globalFilters }), [globalFilters, widget.config]);
  const chartData = useMemo(
    () => buildModelChartData(datasets, dataModel, effectiveConfig) ?? buildChartData(dataset, effectiveConfig),
    [dataModel, dataset, datasets, effectiveConfig],
  );
  const option = useChartOptions({ widget, chartData });
  const chartKey = useMemo(
    () => `${widget.id}:${widget.type}:${chartData.categories.join("|")}:${chartData.series.map((item) => `${item.name}:${item.data.join(",")}`).join("|")}`,
    [chartData.categories, chartData.series, widget.id, widget.type],
  );

  if (widget.type === "text") {
    return <div className="whitespace-pre-wrap p-3" style={textStyleFromWidget(widget)}>{widget.style.text}</div>;
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
    if (category === GROUPED_OTHERS_LABEL && (widget.config.dimensionGroupingMode ?? "none") !== "none") return;
    if (!dimension || widget.config.enableCrossFilter === false) return;
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
    const selectedColumns = widget.config.dimensions?.filter(Boolean) ?? [];
    const selectedMetricColumns = activeMetricConfigs(widget.config)
      .map((metric) => metric.column ?? metric.id)
      .filter((metric): metric is string => Boolean(metric) && !isRecordCountMetric(metric));
    const fallbackColumns = getVisibleDatasetColumns(dataset).map((column) => column.name);
    const tableColumnKeys = [...(selectedColumns.length ? selectedColumns : fallbackColumns), ...selectedMetricColumns.filter((metric) => !selectedColumns.includes(metric))];
    const tableColumnLabels = buildColumnLabelMap(tableColumnKeys, dataset, datasets);
    return (
      <DataTable
        widget={widget}
        rows={chartData.rows}
        columnKeys={tableColumnKeys}
        columnLabels={tableColumnLabels}
        columnConfigs={getDatasetColumnConfig(dataset)}
        limit={widget.config.limit ?? 20}
        onRowClick={(row) => {
          const dimension = selectedColumns[0] ?? fallbackColumns[0];
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
        widget={widget}
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
    const metricLabel = isRecordCountMetric(widget.config.metric) ? RECORD_COUNT_LABEL : metricConfig?.label ?? widget.config.metric ?? "registros";
    const showTitle = widget.style.showTitle ?? true;
    const contentAlign = widget.style.contentAlign ?? "left";
    return (
      <div className={cn("flex h-full flex-col justify-center px-4", contentAlign === "center" && "items-center", contentAlign === "right" && "items-end")} style={{ textAlign: contentAlign }}>
        {showTitle ? <span className="text-xs text-muted-foreground" style={textStyleFromWidget(widget)}>{widget.style.title}</span> : null}
        <strong className="font-mono text-3xl tracking-normal" style={{ ...textStyleFromWidget(widget), fontSize: widget.style.fontSize ? `${Math.max(widget.style.fontSize + 14, 24)}px` : undefined }}>{formatValue(value, metricConfig?.format)}</strong>
        <span className="text-xs text-muted-foreground" style={textStyleFromWidget(widget)}>{widget.config.aggregation} de {metricLabel}</span>
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
        <MeasuredChart chartKey={chartKey} option={option} onCategoryClick={handleCategoryClick} onBlankClick={onClearInteractionFilters} />
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

type ChartInstance = {
  resize: () => void;
  getZr?: () => {
    on: (eventName: "click", handler: (event: { target?: unknown }) => void) => void;
    off: (eventName: "click", handler: (event: { target?: unknown }) => void) => void;
  };
};

function MeasuredChart({ chartKey, option, onCategoryClick, onBlankClick }: { chartKey: string; option: object; onCategoryClick?: (category: string) => void; onBlankClick?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartResizeObserverRef = useRef<ResizeObserver | null>(null);
  const blankClickRef = useRef(onBlankClick);
  const blankClickHandlerRef = useRef<((event: { target?: unknown }) => void) | null>(null);
  const zrRef = useRef<ReturnType<NonNullable<ChartInstance["getZr"]>> | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    blankClickRef.current = onBlankClick;
  }, [onBlankClick]);

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

  useEffect(() => () => {
    chartResizeObserverRef.current?.disconnect();
    if (zrRef.current && blankClickHandlerRef.current) {
      zrRef.current.off("click", blankClickHandlerRef.current);
    }
  }, []);

  const handleChartReady = useCallback((chart: ChartInstance) => {
    chartResizeObserverRef.current?.disconnect();
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    chartResizeObserverRef.current = observer;
    chart.resize();

    const zr = chart.getZr?.();
    if (!zr) return;
    if (zrRef.current && blankClickHandlerRef.current) {
      zrRef.current.off("click", blankClickHandlerRef.current);
    }
    const blankClickHandler = (event: { target?: unknown }) => {
      if (!event.target) blankClickRef.current?.();
    };
    blankClickHandlerRef.current = blankClickHandler;
    zrRef.current = zr;
    zr.on("click", blankClickHandler);
  }, []);

  const ready = size.width > 8 && size.height > 8;

  return (
    <div ref={ref} className="chart-container h-full min-h-[320px] w-full min-w-0">
      {ready ? (
        <ReactECharts
          key={chartKey}
          option={option}
          onEvents={{ click: (params: { name?: string }) => params.name ? onCategoryClick?.(String(params.name)) : undefined }}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "svg" }}
          onChartReady={handleChartReady}
          notMerge
          lazyUpdate
          autoResize={false}
        />
      ) : (
        <ChartLoadingState label="Preparando gráfico..." />
      )}
    </div>
  );
}

function DataTable({ widget, rows, columnKeys, columnLabels, columnConfigs, limit, onRowClick }: { widget: ReportWidget; rows: DatasetRow[]; columnKeys: string[]; columnLabels?: Map<string, string>; columnConfigs: DatasetColumnConfig[]; limit: number; onRowClick?: (row: DatasetRow) => void }) {
  const configByName = useMemo(() => new Map(columnConfigs.map((column) => [column.name, column])), [columnConfigs]);
  const data = useMemo(() => rows.slice(0, limit), [rows, limit]);
  const heatmapStats = useMemo(() => buildColumnHeatmapStats(data, columnKeys, configByName), [columnKeys, configByName, data]);
  const columns = useMemo(
    () => columnKeys.map((column) => ({
      id: column,
      accessorFn: (row: DatasetRow) => row[column],
      header: columnLabels?.get(column) ?? configByName.get(column)?.label ?? readableColumnName(column),
      cell: (info: { getValue: () => unknown }) => formatValue(info.getValue(), configByName.get(column)?.format),
    })),
    [columnKeys, columnLabels, configByName],
  );
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
              {row.getVisibleCells().map((cell) => {
                const columnKey = cell.column.id;
                const value = row.original[columnKey];
                return (
                  <TableCell
                    key={cell.id}
                    className={cn(configByName.get(columnKey)?.type === "number" && "text-right")}
                    style={heatmapCellStyle(value, heatmapStats.get(columnKey), widget)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
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
    return { key, label: typeof metric === "string" ? (isRecordCountMetric(key) ? RECORD_COUNT_LABEL : columnLabel ?? metric) : metric.label };
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
          className="h-7 max-w-44 bg-card/95 px-2 text-xs font-medium shadow-sm"
          title={`Limpiar filtro: ${String(interactionFilter.value)}`}
          aria-label={`Limpiar filtro: ${String(interactionFilter.value)}`}
          onClick={(event) => {
            event.stopPropagation();
            onClearInteractionFilter();
          }}
        >
          <span className="truncate">Ver todo</span>
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
  widget,
  rows,
  rowDimension,
  columnDimension,
  metric,
  columnConfigs,
  aggregation,
  limit,
}: {
  widget: ReportWidget;
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
  const metricColumn = isRecordCountMetric(metric?.id) ? undefined : metric?.column ?? metric?.id;
  const metricConfig = columnConfigs.find((column) => column.name === metricColumn);

  const cellValue = (rowLabelValue: string, columnLabelValue: string) => {
    const grouped = rows.filter((row) => String(row[rowDimension] ?? "Sin valor") === rowLabelValue && String(row[columnDimension] ?? "Sin valor") === columnLabelValue);
    return aggregate(metricColumn ? grouped.map((row) => row[metricColumn]) : grouped.map(() => 1), metric?.aggregation ?? aggregation);
  };
  const heatmapStats = buildValueHeatmapStats(
    rowLabels.flatMap((rowLabelValue) => columnLabels.map((columnLabelValue) => cellValue(rowLabelValue, columnLabelValue))),
  );

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
                {values.map((value, index) => (
                  <TableCell
                    key={`${rowLabelValue}-${columnLabels[index]}`}
                    className="text-right"
                    style={heatmapCellStyle(value, heatmapStats, widget)}
                  >
                    {formatValue(value, metricConfig?.format ?? "number")}
                  </TableCell>
                ))}
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
        {showTitle ? <span className="text-xs font-medium text-muted-foreground" style={textStyleFromWidget(widget)}>{widget.style.title || label}</span> : null}
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
        {showTitle ? <span className="text-xs font-medium text-muted-foreground" style={textStyleFromWidget(widget)}>{widget.style.title || label}</span> : null}
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
      {showTitle ? <span className="text-xs font-medium text-muted-foreground" style={textStyleFromWidget(widget)}>{widget.style.title || label}</span> : null}
      <Input value={textValue} onChange={(event) => setControlValue(widget.id, event.target.value ? event.target.value : undefined)} placeholder="Filtrar..." />
    </div>
  );
}

function uniqueColumnValues(dataset: Dataset, column: string) {
  return Array.from(new Set(dataset.rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== "").map(String))).sort((a, b) => a.localeCompare(b));
}

function buildColumnLabelMap(columnKeys: string[], dataset?: Dataset, datasets?: Dataset[]) {
  const labels = new Map<string, string>();
  const currentDatasetConfig = dataset ? new Map(getDatasetColumnConfig(dataset).map((column) => [column.name, column.label])) : new Map<string, string>();
  const datasetById = new Map((datasets ?? []).map((item) => [item.id, item]));

  columnKeys.forEach((columnKey) => {
    const separator = columnKey.indexOf(".");
    if (separator === -1) {
      labels.set(columnKey, currentDatasetConfig.get(columnKey) ?? readableColumnName(columnKey));
      return;
    }

    const datasetId = columnKey.slice(0, separator);
    const columnName = columnKey.slice(separator + 1);
    const relatedDataset = datasetById.get(datasetId);
    const relatedLabel = relatedDataset
      ? getDatasetColumnConfig(relatedDataset).find((column) => column.name === columnName)?.label
      : undefined;
    labels.set(columnKey, relatedLabel ?? readableColumnName(columnKey));
  });

  return labels;
}

function buildColumnHeatmapStats(rows: DatasetRow[], columnKeys: string[], configByName: Map<string, DatasetColumnConfig>) {
  return new Map(
    columnKeys.map((columnKey) => {
      const columnConfig = configByName.get(columnKey);
      if (columnConfig?.type !== "number") return [columnKey, undefined] as const;
      const values = rows.map((row) => Number(row[columnKey])).filter((value) => Number.isFinite(value));
      return [columnKey, buildValueHeatmapStats(values)] as const;
    }),
  );
}

function buildValueHeatmapStats(values: number[]) {
  if (!values.length) return undefined;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max };
}

function heatmapCellStyle(value: unknown, stats: { min: number; max: number } | undefined, widget: ReportWidget) {
  if (!(widget.style.showHeatmap ?? false) || !stats) return undefined;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return undefined;

  const range = stats.max - stats.min;
  const normalized = range <= 0 ? 1 : (numericValue - stats.min) / range;
  const alpha = 0.08 + normalized * 0.34;
  return {
    backgroundColor: toRgba(widget.style.heatmapColor ?? "#22c55e", alpha),
  };
}

function toRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;
  const safeHex = expanded.length === 6 ? expanded : "22c55e";
  const r = Number.parseInt(safeHex.slice(0, 2), 16);
  const g = Number.parseInt(safeHex.slice(2, 4), 16);
  const b = Number.parseInt(safeHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
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
