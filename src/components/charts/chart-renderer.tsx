"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ChartConfig, Dataset, DatasetRow, ReportWidget } from "@/types";
import { aggregate, applyFilters } from "@/lib/dataset";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-[var(--dh-gray-700)]">Cargando gráfico...</div>,
});

type Props = {
  widget: ReportWidget;
  dataset?: Dataset;
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
  bottom: 4,
  padding: [14, 0, 0, 0],
};

function activeDimensions(config: ChartConfig) {
  const dimensions = config.dimensions?.filter(Boolean) ?? [];
  return dimensions.length ? dimensions : config.dimension ? [config.dimension] : [];
}

function activeMetrics(config: ChartConfig) {
  const metrics = config.metrics?.filter(Boolean) ?? [];
  return metrics.length ? metrics : config.metric ? [config.metric] : [];
}

function rowLabel(row: DatasetRow, dimensions: string[]) {
  if (!dimensions.length) return "Total";
  return dimensions.map((dimension) => String(row[dimension] ?? "Sin valor")).join(" · ");
}

function buildChartData(dataset: Dataset | undefined, config: ChartConfig) {
  const dimensions = activeDimensions(config);
  const metrics = activeMetrics(config);
  if (!dataset) return { dimensions, metrics, categories: [], series: [] as { name: string; data: number[] }[], rows: [] as DatasetRow[] };

  const rows = applyFilters(dataset.rows, config.filters ?? []);
  const groups = new Map<string, DatasetRow[]>();
  rows.forEach((row) => {
    const label = rowLabel(row, dimensions);
    groups.set(label, [...(groups.get(label) ?? []), row]);
  });

  const categories = Array.from(groups.keys()).slice(0, config.limit ?? 50);
  const series = (metrics.length ? metrics : ["registros"]).map((metric) => ({
    name: metric,
    data: categories.map((category) => {
      const groupedRows = groups.get(category) ?? [];
      const values = metric === "registros" ? groupedRows.map(() => 1) : groupedRows.map((row) => row[metric]);
      return aggregate(values, metric === "registros" ? "count" : config.aggregation);
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

function ChartRendererBase({ widget, dataset }: Props) {
  const chartData = useMemo(() => buildChartData(dataset, widget.config), [dataset, widget.config]);
  const option = useMemo(
    () => {
      const colors = widget.style.seriesColors?.length ? widget.style.seriesColors : defaultColors;
      const firstMetric = chartData.series[0];
      const showLegend = widget.style.showLegend ?? true;
      const showPiePercent = widget.style.showPiePercent ?? false;
      const requestedPieOuterRadius = widget.style.pieOuterRadius ?? 58;
      const pieOuterRadius = showLegend ? Math.min(requestedPieOuterRadius, 56) : requestedPieOuterRadius;
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
            center: ["50%", showLegend ? "36%" : "50%"],
            top: 0,
            bottom: showLegend ? 74 : 0,
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

  if (widget.type === "table") return <DataTable dataset={dataset} limit={widget.config.limit ?? 20} />;

  if (widget.type === "kpi" || widget.type === "scorecard") {
    const value = chartData.series[0]?.data[0] ?? 0;
    return (
      <div className="flex h-full flex-col justify-center px-4">
        <span className="text-xs text-[var(--dh-gray-700)]">{widget.style.title}</span>
        <strong className="font-mono text-3xl tracking-normal">{Intl.NumberFormat("es-AR").format(value)}</strong>
        <span className="text-xs text-[var(--dh-gray-700)]">{widget.config.aggregation} de {widget.config.metric ?? "registros"}</span>
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
        <div className="flex h-full items-center justify-center text-xs text-[var(--dh-gray-700)]">Preparando gráfico...</div>
      )}
    </div>
  );
}

function DataTable({ dataset, limit }: { dataset: Dataset; limit: number }) {
  const columns = useMemo(
    () => dataset.columns.map((column) => ({
      accessorKey: column.name,
      header: column.name,
      cell: (info: { getValue: () => unknown }) => String(info.getValue() ?? ""),
    })),
    [dataset.columns],
  );
  const data = useMemo(() => dataset.rows.slice(0, limit), [dataset.rows, limit]);
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

function EmptyWidget({ label }: { label: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-[var(--dh-gray-700)]">{label}</div>;
}

export const ChartRenderer = memo(ChartRendererBase);
