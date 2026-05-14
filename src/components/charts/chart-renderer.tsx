"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ChartConfig, ColumnFormat, Dataset, DatasetColumnConfig, DatasetRow, ReportWidget, WidgetMetric } from "@/types";
import { aggregate, applyCalculatedFields, applyFilters, getDatasetColumnConfig, getVisibleDatasetColumns } from "@/lib/dataset";
import { executeWidgetQuery, queryFieldFromKey } from "@/lib/data-model/query";
import type { DataModel } from "@/lib/data-model/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Cargando gráfico...</div>,
});

type Props = {
  widget: ReportWidget;
  dataset?: Dataset;
  datasets?: Dataset[];
  dataModel?: DataModel;
};

const defaultColors = ["#3333ff", "#00cc7e", "#ffc51a", "#ff7059", "#8a6df1", "#ff76e2"];
const bottomLegend = {
  bottom: 8,
  type: "scroll",
  itemGap: 14,
  itemWidth: 12,
  itemHeight: 8,
  textStyle: { fontSize: 11 },
};
const pieLegend = {
  ...bottomLegend,
  bottom: 6,
  padding: [18, 0, 0, 0],
};

function activeDimensions(config: ChartConfig) {
  const dimensions = config.dimensions?.filter(Boolean) ?? [];
  return dimensions.length ? dimensions : config.dimension ? [config.dimension] : [];
}

function activeMetricConfigs(config: ChartConfig): WidgetMetric[] {
  const metrics = config.metrics?.filter(Boolean).map((metric) => (
    typeof metric === "string"
      ? { id: metric, column: metric, label: metric, aggregation: config.aggregation }
      : metric
  )) ?? [];
  return metrics.length ? metrics : config.metric ? [{ id: config.metric, column: config.metric, label: config.metric, aggregation: config.aggregation }] : [];
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

function ChartRendererBase({ widget, dataset, datasets, dataModel }: Props) {
  const chartData = useMemo(
    () => buildModelChartData(datasets, dataModel, widget.config) ?? buildChartData(dataset, widget.config),
    [dataModel, dataset, datasets, widget.config],
  );
  const option = useMemo(
    () => {
      const colors = widget.style.seriesColors?.length ? widget.style.seriesColors : defaultColors;
      const firstMetric = chartData.series[0];
      const showLegend = widget.style.showLegend ?? true;
      const showPiePercent = widget.style.showPiePercent ?? false;
      const requestedPieOuterRadius = widget.style.pieOuterRadius ?? 58;
      const pieOuterRadius = showLegend ? Math.min(Math.max(requestedPieOuterRadius, 66), 72) : requestedPieOuterRadius;
      const pieRadius = widget.type === "donut"
        ? [`${widget.style.pieInnerRadius ?? 45}%`, `${pieOuterRadius}%`]
        : [`${widget.style.pieInnerRadius ?? 0}%`, `${pieOuterRadius}%`];

      if (widget.type === "pie" || widget.type === "donut") {
        const pieData = chartData.categories.map((name, index) => ({ name, value: firstMetric?.data[index] ?? 0 }));
        const total = pieData.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
        const percentByName = new Map(
          pieData.map((item) => [
            item.name,
            total > 0 ? `${((Number(item.value) / total) * 100).toFixed(1).replace(".0", "")}%` : "0%",
          ]),
        );

        return {
          color: colors,
          tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
          legend: {
            ...pieLegend,
            show: showLegend,
            formatter: showPiePercent ? (name: string) => `${name} ${percentByName.get(name) ?? ""}` : undefined,
          },
          series: [{
            type: "pie",
            radius: pieRadius,
            center: ["50%", showLegend ? "40%" : "50%"],
            top: 0,
            bottom: showLegend ? 58 : 0,
            avoidLabelOverlap: true,
            label: {
              show: widget.style.showDataLabels,
              formatter: showPiePercent ? "{b}: {d}%" : "{b}",
              fontSize: 11,
            },
            labelLine: { show: widget.style.showDataLabels, length: 8, length2: 8 },
            data: pieData,
          }],
        };
      }

      if (widget.type === "scatter") {
        const [xMetric, yMetric] = chartData.metrics;
        const rows = chartData.rows.slice(0, widget.config.limit ?? 50);
        return {
          color: colors,
          tooltip: { trigger: "item" },
          legend: { ...bottomLegend, show: widget.style.showLegend },
          grid: { top: 28, right: 16, bottom: widget.style.showLegend ? 72 : 36, left: 44, containLabel: true },
          xAxis: { type: "value", name: xMetric },
          yAxis: { type: "value", name: yMetric },
          series: [{
            name: `${xMetric ?? "x"} / ${yMetric ?? "y"}`,
            type: "scatter",
            symbolSize: 9,
            data: rows.map((row) => [Number(row[xMetric] ?? 0), Number(row[yMetric] ?? 0)]),
          }],
        };
      }

      const isHorizontal = widget.type === "horizontal_bar";
      const isStacked = widget.type === "stacked_bar" || widget.style.stackSeries;
      const isLineLike = widget.type === "line" || widget.type === "multi_line" || widget.type === "area";
      const series = chartData.series.map((item, index) => {
        const comboLine = widget.type === "combo" && index > 0;
        const type = comboLine || isLineLike ? "line" : "bar";
        return {
          name: item.name,
          type,
          stack: isStacked ? "total" : undefined,
          smooth: type === "line",
          yAxisIndex: widget.type === "combo" && comboLine ? 1 : 0,
          areaStyle: widget.type === "area" ? {} : undefined,
          lineStyle: type === "line" ? { width: widget.style.lineWidth ?? 2 } : undefined,
          itemStyle: {
            color: colors[index % colors.length],
            borderRadius: type === "bar" ? widget.style.barRadius ?? 3 : undefined,
          },
          label: { show: widget.style.showDataLabels },
          data: item.data,
        };
      });

      return {
        color: colors,
        tooltip: { trigger: "axis" },
        legend: { ...bottomLegend, show: widget.style.showLegend },
        grid: { top: 28, right: 16, bottom: widget.style.showLegend ? 76 : 38, left: 44, containLabel: true },
        xAxis: isHorizontal ? { type: "value" } : { type: "category", data: chartData.categories },
        yAxis: widget.type === "combo"
          ? [{ type: "value" }, { type: "value" }]
          : isHorizontal ? { type: "category", data: chartData.categories } : { type: "value" },
        series,
      };
    },
    [chartData, widget.config.limit, widget.style, widget.type],
  );

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
    return <EmptyWidget label={widget.type === "control_date" ? "Control de fecha" : widget.type === "control_select" ? "Selector" : "Filtro de texto"} />;
  }

  if (!dataset) return <EmptyWidget label="Seleccioná una fuente de datos" />;

  if (widget.type === "table") {
    const selectedColumns = activeDimensions(widget.config);
    const fallbackColumns = getVisibleDatasetColumns(dataset).map((column) => column.name);
    return (
      <DataTable
        rows={chartData.rows}
        columnKeys={selectedColumns.length ? selectedColumns : fallbackColumns}
        columnConfigs={getDatasetColumnConfig(dataset)}
        limit={widget.config.limit ?? 20}
      />
    );
  }

  if (widget.type === "kpi" || widget.type === "scorecard") {
    const value = chartData.series[0]?.data[0] ?? 0;
    const metricConfig = getDatasetColumnConfig(dataset).find((column) => column.name === widget.config.metric);
    return (
      <div className="flex h-full flex-col justify-center px-4">
        <span className="text-xs text-muted-foreground">{widget.style.title}</span>
        <strong className="font-mono text-3xl tracking-normal">{formatValue(value, metricConfig?.format)}</strong>
        <span className="text-xs text-muted-foreground">{widget.config.aggregation} de {metricConfig?.label ?? widget.config.metric ?? "registros"}</span>
      </div>
    );
  }

  return <MeasuredChart option={option} />;
}

function MeasuredChart({ option }: { option: object }) {
  const ref = useRef<HTMLDivElement>(null);
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

  const ready = size.width > 8 && size.height > 8;

  return (
    <div ref={ref} className="h-full min-h-0 w-full min-w-0">
      {ready ? (
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          notMerge
          lazyUpdate
          autoResize
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Preparando gráfico...</div>
      )}
    </div>
  );
}

function DataTable({ rows, columnKeys, columnConfigs, limit }: { rows: DatasetRow[]; columnKeys: string[]; columnConfigs: DatasetColumnConfig[]; limit: number }) {
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
            <TableRow key={row.id}>
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
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{label}</div>;
}

export const ChartRenderer = memo(ChartRendererBase);
