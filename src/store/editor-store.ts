"use client";

import { create } from "zustand";
import type { Dataset, Report, ReportMode, ReportPage, ReportTheme, ReportWidget, WidgetMetric, WidgetType } from "@/types";
import { createEmptyReport, defaultTheme } from "@/lib/demo-data";
import { ensureDatasetConfig } from "@/lib/dataset";
import { reportService } from "@/services/report-service";

type Snapshot = Report;

type EditorState = {
  report: Report;
  activePageId: string;
  selectedWidgetId?: string;
  mode: ReportMode;
  zoom: number;
  loading: boolean;
  error?: string;
  past: Snapshot[];
  future: Snapshot[];
  setReport: (report: Report) => void;
  setMode: (mode: ReportMode) => void;
  setZoom: (zoom: number) => void;
  selectPage: (pageId: string) => void;
  selectWidget: (widgetId?: string) => void;
  updateReport: (patch: Partial<Omit<Report, "projectId">>) => void;
  addPage: () => void;
  updatePage: (pageId: string, patch: Partial<ReportPage>) => void;
  addWidget: (type: WidgetType) => void;
  duplicateWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, patch: Partial<ReportWidget>) => void;
  updateWidgetLayouts: (layouts: { i: string; x: number; y: number; w: number; h: number }[]) => void;
  toggleWidgetLocked: (widgetId: string) => void;
  bringWidgetToFront: (widgetId: string) => void;
  sendWidgetToBack: (widgetId: string) => void;
  removeWidget: (widgetId: string) => void;
  addDataset: (dataset: Dataset) => void;
  updateDataset: (datasetId: string, patch: Partial<Dataset>) => void;
  removeDataset: (datasetId: string) => void;
  updateDataModel: (dataModel: NonNullable<Report["dataModel"]>) => void;
  updateTheme: (theme: Partial<ReportTheme>) => void;
  undo: () => void;
  redo: () => void;
  autosave: () => Promise<void>;
};

const timestamp = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const fieldBelongsToDataset = (field: string | undefined, datasetId: string) => Boolean(field?.startsWith(`${datasetId}.`));
const metricField = (metric: string | WidgetMetric | undefined) => (
  typeof metric === "string" ? metric : metric?.column ?? metric?.id
);

function withHistory(state: EditorState, report: Report) {
  return { report, past: [...state.past.slice(-24), state.report], future: [], error: undefined };
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

function activePage(state: EditorState) {
  return state.report.pages.find((page) => page.id === state.activePageId) ?? state.report.pages[0];
}

function normalizeReportDatasets(report: Report): Report {
  return { ...report, datasets: report.datasets.map(ensureDatasetConfig) };
}

function defaultWidget(type: WidgetType, projectId: string, pageId: string, datasetId?: string): ReportWidget {
  const isControl = type.startsWith("control");
  const isText = type === "text";
  return {
    id: uuid(),
    projectId,
    pageId,
    type,
    x: 0,
    y: Infinity,
    w: isControl || isText ? 3 : 5,
    h: type === "scorecard" || type === "kpi" ? 3 : isControl || isText ? 2 : 5,
    locked: false,
    config: {
      datasetId,
      dimension: undefined,
      dimensions: [],
      metric: undefined,
      metrics: [],
      aggregation: "sum",
      filters: [],
      limit: 20,
    },
    style: {
      title: isText ? "Texto" : "Nuevo componente",
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

export const useEditorStore = create<EditorState>((set, get) => {
  const initial = createEmptyReport();
  return {
    report: initial,
    activePageId: initial.pages[0].id,
    mode: "edit",
    zoom: 0.92,
    loading: false,
    past: [],
    future: [],

    setReport: (report) => set({ report: normalizeReportDatasets(report), activePageId: report.pages[0]?.id, selectedWidgetId: undefined, past: [], future: [] }),
    setMode: (mode) => set({ mode }),
    setZoom: (zoom) => set({ zoom: Math.min(1.4, Math.max(0.55, zoom)) }),
    selectPage: (pageId) => set({ activePageId: pageId, selectedWidgetId: undefined }),
    selectWidget: (widgetId) => set({ selectedWidgetId: widgetId }),

    updateReport: (patch) =>
      set((state) => withHistory(state, { ...state.report, ...patch, updatedAt: timestamp() })),

    addPage: () =>
      set((state) => {
        const page: ReportPage = {
          id: uuid(),
          projectId: state.report.projectId,
          name: `Página ${state.report.pages.length + 1}`,
          orderIndex: state.report.pages.length,
          widgets: [],
          createdAt: timestamp(),
          updatedAt: timestamp(),
        };
        return { ...withHistory(state, { ...state.report, pages: [...state.report.pages, page], updatedAt: timestamp() }), activePageId: page.id };
      }),

    updatePage: (pageId, patch) =>
      set((state) =>
        withHistory(state, {
          ...state.report,
          pages: state.report.pages.map((page) => (page.id === pageId ? { ...page, ...patch, updatedAt: timestamp() } : page)),
          updatedAt: timestamp(),
        }),
      ),

    addWidget: (type) =>
      set((state) => {
        const page = activePage(state);
        const widget = defaultWidget(type, state.report.projectId, page.id, state.report.datasets[0]?.id);
        return {
          ...withHistory(state, {
            ...state.report,
            pages: state.report.pages.map((item) => (item.id === page.id ? { ...item, widgets: [...item.widgets, widget] } : item)),
            updatedAt: timestamp(),
          }),
          selectedWidgetId: widget.id,
        };
      }),

    duplicateWidget: (widgetId) =>
      set((state) => {
        const page = state.report.pages.find((item) => item.widgets.some((widget) => widget.id === widgetId));
        const widget = page?.widgets.find((item) => item.id === widgetId);
        if (!page || !widget) return state;

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
          ...withHistory(state, {
            ...state.report,
            pages: state.report.pages.map((item) => (item.id === page.id ? { ...item, widgets: [...item.widgets, duplicated] } : item)),
            updatedAt: timestamp(),
          }),
          selectedWidgetId: duplicated.id,
        };
      }),

    updateWidget: (widgetId, patch) =>
      set((state) =>
        withHistory(state, {
          ...state.report,
          pages: state.report.pages.map((page) => ({
            ...page,
            widgets: page.widgets.map((widget) => (widget.id === widgetId ? { ...widget, ...patch, updatedAt: timestamp() } : widget)),
          })),
          updatedAt: timestamp(),
        }),
      ),

    updateWidgetLayouts: (layouts) =>
      set((state) => {
        const layoutById = new Map(layouts.map((layout) => [layout.i, layout]));
        let changed = false;
        const pages = state.report.pages.map((page) => ({
          ...page,
          widgets: page.widgets.map((widget) => {
            if (widget.locked) return widget;
            const layout = layoutById.get(widget.id);
            if (!layout) return widget;
            if (widget.x === layout.x && widget.y === layout.y && widget.w === layout.w && widget.h === layout.h) {
              return widget;
            }
            changed = true;
            return { ...widget, x: layout.x, y: layout.y, w: layout.w, h: layout.h, updatedAt: timestamp() };
          }),
        }));

        if (!changed) return state;
        return {
          report: { ...state.report, pages, updatedAt: timestamp() },
          error: undefined,
        };
      }),

    removeWidget: (widgetId) =>
      set((state) =>
        withHistory(state, {
          ...state.report,
          pages: state.report.pages.map((page) => ({ ...page, widgets: page.widgets.filter((widget) => widget.id !== widgetId) })),
          updatedAt: timestamp(),
        }),
      ),

    toggleWidgetLocked: (widgetId) =>
      set((state) =>
        withHistory(state, {
          ...state.report,
          pages: state.report.pages.map((page) => ({
            ...page,
            widgets: page.widgets.map((widget) => (widget.id === widgetId ? { ...widget, locked: !widget.locked, updatedAt: timestamp() } : widget)),
          })),
          updatedAt: timestamp(),
        }),
      ),

    bringWidgetToFront: (widgetId) =>
      set((state) =>
        withHistory(state, {
          ...state.report,
          pages: state.report.pages.map((page) => {
            const widget = page.widgets.find((item) => item.id === widgetId);
            if (!widget) return page;
            return { ...page, widgets: [...page.widgets.filter((item) => item.id !== widgetId), widget] };
          }),
          updatedAt: timestamp(),
        }),
      ),

    sendWidgetToBack: (widgetId) =>
      set((state) =>
        withHistory(state, {
          ...state.report,
          pages: state.report.pages.map((page) => {
            const widget = page.widgets.find((item) => item.id === widgetId);
            if (!widget) return page;
            return { ...page, widgets: [widget, ...page.widgets.filter((item) => item.id !== widgetId)] };
          }),
          updatedAt: timestamp(),
        }),
      ),

    addDataset: (dataset) =>
      set((state) => {
        const nextDataset = ensureDatasetConfig({
          ...dataset,
          id: state.report.datasets.some((item) => item.id === dataset.id) ? uuid() : dataset.id || uuid(),
          projectId: state.report.projectId,
          name: visibleDatasetName(dataset.name || "Dataset", state.report.datasets),
          createdAt: dataset.createdAt || timestamp(),
          updatedAt: timestamp(),
        });

        return withHistory(state, { ...state.report, datasets: [...state.report.datasets, nextDataset], updatedAt: timestamp() });
      }),

    updateDataset: (datasetId, patch) =>
      set((state) =>
        withHistory(state, {
          ...state.report,
          datasets: state.report.datasets.map((dataset) =>
            dataset.id === datasetId ? ensureDatasetConfig({ ...dataset, ...patch, updatedAt: timestamp() }) : dataset,
          ),
          updatedAt: timestamp(),
        }),
      ),

    removeDataset: (datasetId) =>
      set((state) => {
        const removed = state.report.datasets.some((dataset) => dataset.id === datasetId);
        if (!removed) return state;

        const dataModel = {
          relationships: (state.report.dataModel?.relationships ?? []).filter(
            (relationship) => relationship.fromDatasetId !== datasetId && relationship.toDatasetId !== datasetId,
          ),
        };

        return withHistory(state, {
          ...state.report,
          datasets: state.report.datasets.filter((dataset) => dataset.id !== datasetId),
          dataModel,
          pages: state.report.pages.map((page) => ({
            ...page,
            widgets: page.widgets.map((widget) => cleanWidgetDatasetReferences(widget, datasetId)),
          })),
          updatedAt: timestamp(),
        });
      }),

    updateDataModel: (dataModel) =>
      set((state) =>
        withHistory(state, { ...state.report, dataModel, updatedAt: timestamp() }),
      ),

    updateTheme: (theme) =>
      set((state) =>
        withHistory(state, { ...state.report, theme: { ...state.report.theme, ...theme }, updatedAt: timestamp() }),
      ),

    undo: () =>
      set((state) => {
        const previous = state.past.at(-1);
        if (!previous) return state;
        return { report: previous, past: state.past.slice(0, -1), future: [state.report, ...state.future], selectedWidgetId: undefined };
      }),

    redo: () =>
      set((state) => {
        const next = state.future[0];
        if (!next) return state;
        return { report: next, past: [...state.past, state.report], future: state.future.slice(1), selectedWidgetId: undefined };
      }),

    autosave: async () => {
      const state = get();
      set({ loading: true, error: undefined });
      try {
        await reportService.saveReport(state.report);
        set({ loading: false });
      } catch (error) {
        set({ loading: false, error: error instanceof Error ? error.message : "No se pudo guardar." });
      }
    },
  };
});
