"use client";

import type {
  Dataset,
  Report,
  ReportPage,
  ReportTheme,
  ReportWidget,
  WidgetMetric,
  WidgetType,
} from "@/types";
import { defaultTheme } from "@/lib/demo-data";
import { ensureDatasetConfig } from "@/lib/dataset";

export type WidgetLayoutPatch = { i: string; x: number; y: number; w: number; h: number };

const timestamp = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const fieldBelongsToDataset = (field: string | undefined, datasetId: string) => Boolean(field?.startsWith(`${datasetId}.`));
const metricField = (metric: string | WidgetMetric | undefined) => (typeof metric === "string" ? metric : metric?.column ?? metric?.id);

export function normalizeReportDatasets(report: Report): Report {
  return { ...report, datasets: report.datasets.map(ensureDatasetConfig) };
}

export function activePage(report: Report, activePageId: string) {
  return report.pages.find((page) => page.id === activePageId) ?? report.pages[0];
}

export function updateReport(report: Report, patch: Partial<Omit<Report, "projectId">>): Report {
  return { ...report, ...patch, updatedAt: timestamp() };
}

export function addPage(report: Report) {
  const page: ReportPage = {
    id: uuid(),
    projectId: report.projectId,
    name: `Página ${report.pages.length + 1}`,
    orderIndex: report.pages.length,
    filters: [],
    widgets: [],
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };

  return {
    report: { ...report, pages: [...report.pages, page], updatedAt: timestamp() },
    activePageId: page.id,
  };
}

export function duplicatePage(report: Report, pageId: string) {
  const sourcePage = report.pages.find((page) => page.id === pageId);
  if (!sourcePage) return undefined;

  const nextPageId = uuid();
  const page: ReportPage = {
    ...sourcePage,
    id: nextPageId,
    name: `${sourcePage.name} copia`,
    orderIndex: report.pages.length,
    widgets: sourcePage.widgets.map((widget) => ({
      ...widget,
      id: uuid(),
      pageId: nextPageId,
      locked: false,
      createdAt: timestamp(),
      updatedAt: timestamp(),
    })),
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };

  return {
    report: { ...report, pages: [...report.pages, page], updatedAt: timestamp() },
    activePageId: page.id,
  };
}

export function updatePage(report: Report, pageId: string, patch: Partial<ReportPage>): Report {
  return {
    ...report,
    pages: report.pages.map((page) => (page.id === pageId ? { ...page, ...patch, updatedAt: timestamp() } : page)),
    updatedAt: timestamp(),
  };
}

export function removePage(report: Report, activePageId: string, pageId: string) {
  if (report.pages.length <= 1) return undefined;

  const pages = report.pages
    .filter((page) => page.id !== pageId)
    .map((page, index) => ({ ...page, orderIndex: index, updatedAt: timestamp() }));

  return {
    report: { ...report, pages, updatedAt: timestamp() },
    activePageId: activePageId === pageId ? pages[0]?.id : activePageId,
  };
}

export function addWidget(report: Report, activePageId: string, type: WidgetType) {
  const page = activePage(report, activePageId);
  const dataset = report.datasets[0];
  const size = widgetSize(type);
  const placement = findWidgetPlacement(page.widgets, size);
  const widget = defaultWidget(type, report.projectId, page.id, dataset, placement);

  return {
    report: {
      ...report,
      pages: report.pages.map((item) => (item.id === page.id ? { ...item, widgets: [...item.widgets, widget] } : item)),
      updatedAt: timestamp(),
    },
    selectedWidgetId: widget.id,
  };
}

export function duplicateWidget(report: Report, widgetId: string) {
  const page = report.pages.find((item) => item.widgets.some((widget) => widget.id === widgetId));
  const widget = page?.widgets.find((item) => item.id === widgetId);
  if (!page || !widget) return undefined;

  const duplicated: ReportWidget = {
    ...widget,
    id: uuid(),
    x: Math.min(Math.max(0, widget.x + 1), Math.max(0, 12 - widget.w)),
    y: widget.y + 1,
    locked: false,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };

  return {
    report: {
      ...report,
      pages: report.pages.map((item) => (item.id === page.id ? { ...item, widgets: [...item.widgets, duplicated] } : item)),
      updatedAt: timestamp(),
    },
    selectedWidgetId: duplicated.id,
  };
}

export function updateWidget(report: Report, widgetId: string, patch: Partial<ReportWidget>): Report {
  return {
    ...report,
    pages: report.pages.map((page) => ({
      ...page,
      widgets: page.widgets.map((widget) => (widget.id === widgetId ? { ...widget, ...patch, updatedAt: timestamp() } : widget)),
    })),
    updatedAt: timestamp(),
  };
}

export function updateWidgetLayouts(report: Report, layouts: WidgetLayoutPatch[]) {
  const layoutById = new Map(layouts.map((layout) => [layout.i, layout]));
  let changed = false;
  const pages = report.pages.map((page) => ({
    ...page,
    widgets: page.widgets.map((widget) => {
      if (widget.locked) return widget;
      const layout = layoutById.get(widget.id);
      if (!layout) return widget;
      if (widget.x === layout.x && widget.y === layout.y && widget.w === layout.w && widget.h === layout.h) return widget;
      changed = true;
      return { ...widget, x: layout.x, y: layout.y, w: layout.w, h: layout.h, updatedAt: timestamp() };
    }),
  }));

  if (!changed) return undefined;
  return { ...report, pages, updatedAt: timestamp() };
}

export function removeWidget(report: Report, widgetId: string): Report {
  return {
    ...report,
    pages: report.pages.map((page) => ({ ...page, widgets: page.widgets.filter((widget) => widget.id !== widgetId) })),
    updatedAt: timestamp(),
  };
}

export function toggleWidgetLocked(report: Report, widgetId: string): Report {
  return updateWidget(report, widgetId, { locked: !report.pages.flatMap((page) => page.widgets).find((widget) => widget.id === widgetId)?.locked });
}

export function bringWidgetToFront(report: Report, widgetId: string): Report {
  return {
    ...report,
    pages: report.pages.map((page) => {
      const widget = page.widgets.find((item) => item.id === widgetId);
      if (!widget) return page;
      return { ...page, widgets: [...page.widgets.filter((item) => item.id !== widgetId), widget] };
    }),
    updatedAt: timestamp(),
  };
}

export function sendWidgetToBack(report: Report, widgetId: string): Report {
  return {
    ...report,
    pages: report.pages.map((page) => {
      const widget = page.widgets.find((item) => item.id === widgetId);
      if (!widget) return page;
      return { ...page, widgets: [widget, ...page.widgets.filter((item) => item.id !== widgetId)] };
    }),
    updatedAt: timestamp(),
  };
}

export function addDataset(report: Report, dataset: Dataset): Report {
  const nextDataset = ensureDatasetConfig({
    ...dataset,
    id: report.datasets.some((item) => item.id === dataset.id) ? uuid() : dataset.id || uuid(),
    projectId: report.projectId,
    name: visibleDatasetName(dataset.name || "Fuente de datos", report.datasets),
    createdAt: dataset.createdAt || timestamp(),
    updatedAt: timestamp(),
  });

  return { ...report, datasets: [...report.datasets, nextDataset], updatedAt: timestamp() };
}

export function updateDataset(report: Report, datasetId: string, patch: Partial<Dataset>): Report {
  return {
    ...report,
    datasets: report.datasets.map((dataset) => (dataset.id === datasetId ? ensureDatasetConfig({ ...dataset, ...patch, updatedAt: timestamp() }) : dataset)),
    updatedAt: timestamp(),
  };
}

export function removeDataset(report: Report, datasetId: string): Report | undefined {
  const removed = report.datasets.some((dataset) => dataset.id === datasetId);
  if (!removed) return undefined;

  const dataModel = {
    relationships: (report.dataModel?.relationships ?? []).filter(
      (relationship) => relationship.fromDatasetId !== datasetId && relationship.toDatasetId !== datasetId,
    ),
  };

  return {
    ...report,
    datasets: report.datasets.filter((dataset) => dataset.id !== datasetId),
    dataModel,
    pages: report.pages.map((page) => ({
      ...page,
      widgets: page.widgets.map((widget) => cleanWidgetDatasetReferences(widget, datasetId)),
    })),
    updatedAt: timestamp(),
  };
}

export function updateDataModel(report: Report, dataModel: NonNullable<Report["dataModel"]>): Report {
  return { ...report, dataModel, updatedAt: timestamp() };
}

export function updateTheme(report: Report, theme: Partial<ReportTheme>): Report {
  return { ...report, theme: { ...report.theme, ...theme }, updatedAt: timestamp() };
}

function visibleDatasetName(name: string, datasets: Dataset[]) {
  const existingNames = new Set(datasets.map((dataset) => dataset.name));
  if (!existingNames.has(name)) return name;

  let index = 2;
  let nextName = `${name} (${index})`;
  while (existingNames.has(nextName)) {
    index += 1;
    nextName = `${name} (${index})`;
  }

  return nextName;
}

function cleanWidgetDatasetReferences(widget: ReportWidget, datasetId: string): ReportWidget {
  const usesDeletedDataset = widget.config.datasetId === datasetId || widget.config.baseDatasetId === datasetId;
  const nextDimensions = (widget.config.dimensions ?? []).filter((field) => !fieldBelongsToDataset(field, datasetId));
  const nextMetrics = (widget.config.metrics ?? []).filter((field) => !fieldBelongsToDataset(metricField(field), datasetId));
  const nextFilters = (widget.config.filters ?? []).filter((filter) => !fieldBelongsToDataset(filter.column, datasetId));

  if (usesDeletedDataset) {
    return {
      ...widget,
      config: {
        ...widget.config,
        datasetId: undefined,
        baseDatasetId: undefined,
        dimension: undefined,
        dimensions: [],
        metric: undefined,
        metrics: [],
        filters: [],
      },
      updatedAt: timestamp(),
    };
  }

  if (
    nextDimensions.length === (widget.config.dimensions ?? []).length &&
    nextMetrics.length === (widget.config.metrics ?? []).length &&
    nextFilters.length === (widget.config.filters ?? []).length &&
    !fieldBelongsToDataset(widget.config.dimension, datasetId) &&
    !fieldBelongsToDataset(widget.config.metric, datasetId)
  ) {
    return widget;
  }

  return {
    ...widget,
    config: {
      ...widget.config,
      dimension: fieldBelongsToDataset(widget.config.dimension, datasetId) ? nextDimensions[0] : widget.config.dimension,
      dimensions: nextDimensions,
      metric: fieldBelongsToDataset(widget.config.metric, datasetId) ? metricField(nextMetrics[0]) : widget.config.metric,
      metrics: nextMetrics,
      filters: nextFilters,
    },
    updatedAt: timestamp(),
  };
}

function widgetSize(type: WidgetType) {
  const isControl = type.startsWith("control");
  const isText = type === "text";
  if (type === "scorecard" || type === "kpi") return { w: 3, h: 3 };
  if (isControl || isText) return { w: 3, h: 2 };
  if (type === "table" || type === "pivot_table") return { w: 6, h: 5 };
  return { w: 6, h: 5 };
}

function chartDefaults(type: WidgetType, dataset: Dataset | undefined): ReportWidget["config"] {
  const columns = dataset ? ensureDatasetConfig(dataset).columnConfig ?? [] : [];
  const dimension = columns.find((column) => column.visible && (column.type === "text" || column.type === "date"))?.name ?? columns.find((column) => column.visible)?.name;
  const metric = columns.find((column) => column.visible && column.type === "number")?.name;

  if (type.startsWith("control")) {
    return { datasetId: dataset?.id, dimension, dimensions: dimension ? [dimension] : [], metric: undefined, metrics: [], aggregation: "sum", filters: [], limit: 20 };
  }

  if (type === "table" || type === "pivot_table") {
    const dimensions = columns.filter((column) => column.visible).slice(0, 6).map((column) => column.name);
    return { datasetId: dataset?.id, dimension: dimensions[0], dimensions, metric, metrics: metric ? [metric] : [], aggregation: "sum", filters: [], limit: 20 };
  }

  if (type === "scorecard" || type === "kpi") {
    return { datasetId: dataset?.id, dimension: undefined, dimensions: [], metric, metrics: metric ? [metric] : [], aggregation: "sum", filters: [], limit: 20 };
  }

  if (type === "scatter") {
    const metrics = columns.filter((column) => column.visible && column.type === "number").slice(0, 2).map((column) => column.name);
    return { datasetId: dataset?.id, dimension: undefined, dimensions: [], metric: metrics[0], metrics, aggregation: "sum", filters: [], limit: 50 };
  }

  return {
    datasetId: dataset?.id,
    dimension,
    dimensions: dimension ? [dimension] : [],
    metric,
    metrics: metric ? [metric] : [],
    aggregation: "sum",
    filters: [],
    pageFilters: [],
    reportFilters: [],
    enableCrossFilter: true,
    orderDirection: "asc",
    limit: 20,
  };
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function findWidgetPlacement(widgets: ReportWidget[], size: { w: number; h: number }) {
  const candidates = Array.from({ length: Math.max(1, 12 - size.w) }, (_, index) => index + 1);
  const maxY = Math.max(16, ...widgets.map((widget) => widget.y + widget.h + 2));

  for (let y = 1; y <= maxY; y += 1) {
    for (const x of candidates) {
      const candidate = { x, y, ...size };
      if (!widgets.some((widget) => overlaps(candidate, widget))) return { x, y };
    }
  }

  return { x: 1, y: maxY };
}

function defaultWidget(type: WidgetType, projectId: string, pageId: string, dataset?: Dataset, placement?: { x: number; y: number }): ReportWidget {
  const isText = type === "text";
  const size = widgetSize(type);
  return {
    id: uuid(),
    projectId,
    pageId,
    type,
    x: placement?.x ?? 1,
    y: placement?.y ?? 1,
    w: size.w,
    h: size.h,
    locked: false,
    config: chartDefaults(type, dataset),
    style: {
      title: isText ? "Texto" : "Nuevo componente",
      showTitle: type !== "image",
      text: isText ? "Escribí un texto para el informe" : undefined,
      fontFamily: "Geist",
      fontSize: 13,
      color: defaultTheme.text,
      background: "#ffffff",
      borderColor: "#d7dce2",
      borderRadius: 4,
      showLegend: true,
      seriesColors: ["#3333ff", "#00cc7e", "#ffc51a", "#ff7059", "#8a6df1", "#ff76e2"],
      lineWidth: 2,
      barRadius: 3,
      pieInnerRadius: type === "donut" ? 45 : 0,
      pieOuterRadius: 58,
      showDataLabels: false,
      showPiePercent: false,
      stackSeries: type === "stacked_bar",
    },
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };
}
