"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { Dataset, ReportWidget } from "@/types";
import { buildSeries } from "@/lib/dataset";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-[var(--dh-gray-700)]">Cargando gráfico...</div>,
});

type Props = {
  widget: ReportWidget;
  dataset?: Dataset;
};

function ChartRendererBase({ widget, dataset }: Props) {
  const series = useMemo(() => buildSeries(dataset, widget.config), [dataset, widget.config]);
  const labels = useMemo(() => series.map((item) => item.label), [series]);
  const values = useMemo(() => series.map((item) => item.value), [series]);
  const option = useMemo(
    () => widget.type === "pie"
      ? {
        tooltip: { trigger: "item" },
        legend: { show: widget.style.showLegend, bottom: 0 },
        series: [{ type: "pie", radius: ["35%", "65%"], data: series.map((item) => ({ name: item.label, value: item.value })) }],
      }
      : {
        tooltip: { trigger: "axis" },
        legend: { show: widget.style.showLegend },
        grid: { top: 28, right: 16, bottom: 34, left: 44 },
        xAxis: { type: "category", data: labels },
        yAxis: { type: "value" },
        series: [{
          type: widget.type === "area" ? "line" : widget.type,
          smooth: widget.type === "line" || widget.type === "area",
          areaStyle: widget.type === "area" ? {} : undefined,
          data: values,
        }],
      },
    [labels, series, values, widget.style.showLegend, widget.type],
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
    const value = series[0]?.value ?? 0;
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
          key={`${size.width}x${size.height}`}
          option={option}
          style={{ height: size.height, width: size.width }}
          notMerge
          lazyUpdate
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
