"use client";

import { create, type StateCreator } from "zustand";
import type { Dataset, Report, ReportMode, ReportPage, ReportTheme, ReportWidget, WidgetFilter, WidgetType } from "@/types";
import { createEmptyReport } from "@/lib/demo-data";
import { reportService } from "@/services/report-service";
import * as editorEngine from "@/services/editor-engine";

type Snapshot = Report;
type ControlValue = string | [string, string] | undefined;

type HistoryState = {
  past: Snapshot[];
  future: Snapshot[];
  undo: () => void;
  redo: () => void;
};

type ReportSlice = {
  report: Report;
  loading: boolean;
  error?: string;
  setReport: (report: Report) => void;
  updateReport: (patch: Partial<Omit<Report, "projectId">>) => void;
  updateTheme: (theme: Partial<ReportTheme>) => void;
  autosave: () => Promise<void>;
};

type PageSlice = {
  activePageId: string;
  selectPage: (pageId: string) => void;
  addPage: () => void;
  duplicatePage: (pageId: string) => void;
  updatePage: (pageId: string, patch: Partial<ReportPage>) => void;
  removePage: (pageId: string) => void;
};

type WidgetSlice = {
  selectedWidgetId?: string;
  selectWidget: (widgetId?: string) => void;
  addWidget: (type: WidgetType) => void;
  duplicateWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, patch: Partial<ReportWidget>) => void;
  updateWidgetLayouts: (layouts: editorEngine.WidgetLayoutPatch[]) => void;
  toggleWidgetLocked: (widgetId: string) => void;
  bringWidgetToFront: (widgetId: string) => void;
  sendWidgetToBack: (widgetId: string) => void;
  removeWidget: (widgetId: string) => void;
};

type DatasetSlice = {
  addDataset: (dataset: Dataset) => void;
  updateDataset: (datasetId: string, patch: Partial<Dataset>) => void;
  removeDataset: (datasetId: string) => void;
  updateDataModel: (dataModel: NonNullable<Report["dataModel"]>) => void;
};

type UISlice = {
  mode: ReportMode;
  zoom: number;
  controlValues: Record<string, ControlValue>;
  interactionFilters: Record<string, WidgetFilter>;
  setMode: (mode: ReportMode) => void;
  setZoom: (zoom: number) => void;
  setControlValue: (widgetId: string, value: ControlValue) => void;
  setInteractionFilter: (widgetId: string, filter?: WidgetFilter) => void;
};

export type EditorState = ReportSlice & PageSlice & WidgetSlice & DatasetSlice & UISlice & HistoryState;
type SliceCreator<T> = StateCreator<EditorState, [], [], T>;

const initialReport = createEmptyReport();

function withHistory(state: EditorState, report: Report) {
  return { report, past: [...state.past.slice(-24), state.report], future: [], error: undefined };
}

const createReportSlice: SliceCreator<ReportSlice> = (set, get) => ({
  report: initialReport,
  loading: false,
  error: undefined,
  setReport: (report) =>
    set({
      report: editorEngine.normalizeReportDatasets(report),
      activePageId: report.pages[0]?.id,
      selectedWidgetId: undefined,
      past: [],
      future: [],
    }),
  updateReport: (patch) => set((state) => withHistory(state, editorEngine.updateReport(state.report, patch))),
  updateTheme: (theme) => set((state) => withHistory(state, editorEngine.updateTheme(state.report, theme))),
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
});

const createPageSlice: SliceCreator<PageSlice> = (set) => ({
  activePageId: initialReport.pages[0].id,
  selectPage: (pageId) => set({ activePageId: pageId, selectedWidgetId: undefined }),
  addPage: () =>
    set((state) => {
      const next = editorEngine.addPage(state.report);
      return { ...withHistory(state, next.report), activePageId: next.activePageId };
    }),
  duplicatePage: (pageId) =>
    set((state) => {
      const next = editorEngine.duplicatePage(state.report, pageId);
      if (!next) return state;
      return { ...withHistory(state, next.report), activePageId: next.activePageId, selectedWidgetId: undefined };
    }),
  updatePage: (pageId, patch) => set((state) => withHistory(state, editorEngine.updatePage(state.report, pageId, patch))),
  removePage: (pageId) =>
    set((state) => {
      const next = editorEngine.removePage(state.report, state.activePageId, pageId);
      if (!next) return state;
      return { ...withHistory(state, next.report), activePageId: next.activePageId, selectedWidgetId: undefined };
    }),
});

const createWidgetSlice: SliceCreator<WidgetSlice> = (set) => ({
  selectedWidgetId: undefined,
  selectWidget: (widgetId) => set({ selectedWidgetId: widgetId }),
  addWidget: (type) =>
    set((state) => {
      const next = editorEngine.addWidget(state.report, state.activePageId, type);
      return { ...withHistory(state, next.report), selectedWidgetId: next.selectedWidgetId };
    }),
  duplicateWidget: (widgetId) =>
    set((state) => {
      const next = editorEngine.duplicateWidget(state.report, widgetId);
      if (!next) return state;
      return { ...withHistory(state, next.report), selectedWidgetId: next.selectedWidgetId };
    }),
  updateWidget: (widgetId, patch) => set((state) => withHistory(state, editorEngine.updateWidget(state.report, widgetId, patch))),
  updateWidgetLayouts: (layouts) =>
    set((state) => {
      const report = editorEngine.updateWidgetLayouts(state.report, layouts);
      if (!report) return state;
      return { report, error: undefined };
    }),
  removeWidget: (widgetId) => set((state) => withHistory(state, editorEngine.removeWidget(state.report, widgetId))),
  toggleWidgetLocked: (widgetId) => set((state) => withHistory(state, editorEngine.toggleWidgetLocked(state.report, widgetId))),
  bringWidgetToFront: (widgetId) => set((state) => withHistory(state, editorEngine.bringWidgetToFront(state.report, widgetId))),
  sendWidgetToBack: (widgetId) => set((state) => withHistory(state, editorEngine.sendWidgetToBack(state.report, widgetId))),
});

const createDatasetSlice: SliceCreator<DatasetSlice> = (set) => ({
  addDataset: (dataset) => set((state) => withHistory(state, editorEngine.addDataset(state.report, dataset))),
  updateDataset: (datasetId, patch) => set((state) => withHistory(state, editorEngine.updateDataset(state.report, datasetId, patch))),
  removeDataset: (datasetId) =>
    set((state) => {
      const report = editorEngine.removeDataset(state.report, datasetId);
      if (!report) return state;
      return withHistory(state, report);
    }),
  updateDataModel: (dataModel) => set((state) => withHistory(state, editorEngine.updateDataModel(state.report, dataModel))),
});

const createUISlice: SliceCreator<UISlice> = (set) => ({
  mode: "edit",
  zoom: 1,
  controlValues: {},
  interactionFilters: {},
  setMode: (mode) => set({ mode }),
  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.5, zoom)) }),
  setControlValue: (widgetId, value) => set((state) => ({ controlValues: { ...state.controlValues, [widgetId]: value } })),
  setInteractionFilter: (widgetId, filter) =>
    set((state) => {
      const interactionFilters = { ...state.interactionFilters };
      if (filter) interactionFilters[widgetId] = filter;
      else delete interactionFilters[widgetId];
      return { interactionFilters };
    }),
});

const createHistorySlice: SliceCreator<HistoryState> = (set) => ({
  past: [],
  future: [],
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
});

export const useEditorStore = create<EditorState>()((...args) => ({
  ...createReportSlice(...args),
  ...createPageSlice(...args),
  ...createWidgetSlice(...args),
  ...createDatasetSlice(...args),
  ...createUISlice(...args),
  ...createHistorySlice(...args),
}));

export const useReportStore = useEditorStore;
export const usePageStore = useEditorStore;
export const useWidgetStore = useEditorStore;
export const useDatasetStore = useEditorStore;
export const useUIStore = useEditorStore;
