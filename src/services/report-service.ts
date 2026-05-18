"use client";

import type { Dataset, Report, ReportPage, ReportWidget, WidgetType } from "@/types";
import { createDemoReport, createEmptyReport } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/client";

const enabled = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const storageKey = (projectId: string) => `dh-project:${projectId}`;
const workspaceKey = "dh-projects:index";

export type ProjectTemplate = "blank" | "sales";
export type ProjectSummary = {
  projectId: string;
  name: string;
  updatedAt: string;
  pageCount: number;
  isPublic: boolean;
  thumbnail?: string;
};

type DbReport = {
  id?: string;
  project_id: string;
  owner_id?: string;
  name: string;
  is_public: boolean;
  theme: Report["theme"];
  data_model?: Report["dataModel"] | null;
  created_at: string;
  updated_at: string;
};

type DbPage = {
  id: string;
  project_id: string;
  name: string;
  order_index: number;
  created_at: string;
  updated_at: string;
};

type DbDataset = {
  id: string;
  project_id: string;
  owner_id?: string;
  name: string;
  source_type: Dataset["sourceType"];
  source_url?: string | null;
  columns: Dataset["columns"];
  column_config?: Dataset["columnConfig"] | null;
  calculated_fields?: Dataset["calculatedFields"] | null;
  rows: Dataset["rows"];
  created_at: string;
  updated_at: string;
};

type DbWidget = {
  id: string;
  project_id: string;
  page_id: string;
  type: WidgetType;
  layout: { x: number; y: number; w: number; h: number };
  config: ReportWidget["config"];
  style: ReportWidget["style"];
  created_at: string;
  updated_at: string;
};

function persistLocal(report: Report) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(report.projectId), JSON.stringify(report));
  upsertProjectSummary(report);
}

function readLocal(projectId: string) {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(storageKey(projectId));
  return value ? (JSON.parse(value) as Report) : null;
}

function reportSummary(report: Report): ProjectSummary {
  return {
    projectId: report.projectId,
    name: report.name,
    updatedAt: report.updatedAt,
    pageCount: report.pages.length,
    isPublic: report.isPublic,
    thumbnail: createThumbnail(report),
  };
}

function readProjectIndex() {
  if (typeof window === "undefined") return [];
  const value = window.localStorage.getItem(workspaceKey);
  if (!value) return [];
  try {
    return JSON.parse(value) as ProjectSummary[];
  } catch {
    window.localStorage.removeItem(workspaceKey);
    return [];
  }
}

function writeProjectIndex(projects: ProjectSummary[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(workspaceKey, JSON.stringify(projects));
}

function upsertProjectSummary(report: Report) {
  const summary = reportSummary(report);
  const projects = readProjectIndex().filter((project) => project.projectId !== summary.projectId);
  writeProjectIndex([summary, ...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
}

function createThumbnail(report: Report) {
  const page = report.pages[0];
  if (!page) return undefined;

  return JSON.stringify({
    theme: report.theme,
    widgets: page.widgets.slice(0, 8).map((widget) => ({
      id: widget.id,
      type: widget.type,
      x: widget.x,
      y: widget.y,
      w: widget.w,
      h: widget.h,
      color: widget.style.seriesColors?.[0] ?? report.theme.primary,
    })),
  });
}

function createReportFromTemplate(template: ProjectTemplate, name?: string) {
  if (template === "sales") {
    const report = createDemoReport();
    return { ...report, name: name || report.name, updatedAt: new Date().toISOString() };
  }

  return createEmptyReport(undefined, name || "Proyecto sin título");
}

function mapReport(report: DbReport, pages: DbPage[], datasets: DbDataset[], widgets: DbWidget[]): Report {
  return {
    id: report.id,
    projectId: report.project_id,
    ownerId: report.owner_id,
    name: report.name,
    isPublic: report.is_public,
    theme: report.theme,
    dataModel: report.data_model ?? { relationships: [] },
    datasets: datasets.map((dataset) => ({
      id: dataset.id,
      projectId: dataset.project_id,
      ownerId: dataset.owner_id,
      name: dataset.name,
      sourceType: dataset.source_type,
      sourceUrl: dataset.source_url,
      columns: dataset.columns,
      columnConfig: dataset.column_config ?? undefined,
      calculatedFields: dataset.calculated_fields ?? [],
      rows: dataset.rows,
      createdAt: dataset.created_at,
      updatedAt: dataset.updated_at,
    })),
    pages: pages
      .sort((a, b) => a.order_index - b.order_index)
      .map((page) => ({
        id: page.id,
        projectId: page.project_id,
        name: page.name,
        orderIndex: page.order_index,
        widgets: widgets
          .filter((widget) => widget.page_id === page.id)
          .map((widget) => ({
            id: widget.id,
            projectId: widget.project_id,
            pageId: widget.page_id,
            type: widget.type,
            x: widget.layout.x,
            y: widget.layout.y,
            w: widget.layout.w,
            h: widget.layout.h,
            config: widget.config,
            style: widget.style,
            createdAt: widget.created_at,
            updatedAt: widget.updated_at,
          })),
        createdAt: page.created_at,
        updatedAt: page.updated_at,
      })),
    createdAt: report.created_at,
    updatedAt: report.updated_at,
  };
}

export const reportService = {
  isEnabled: enabled,

  async createProject(name = "Proyecto sin título", template: ProjectTemplate = "blank") {
    const report = createReportFromTemplate(template, name);
    await this.saveReport(report);
    return report;
  },

  getRecentProjects() {
    return readProjectIndex();
  },

  async duplicateProject(projectId: string) {
    const source = await this.getReportByProjectId(projectId);
    if (!source) return null;

    const now = new Date().toISOString();
    const nextProjectId = crypto.randomUUID();
    const pageIdBySource = new Map(source.pages.map((page) => [page.id, crypto.randomUUID()]));
    const report: Report = {
      ...source,
      id: undefined,
      projectId: nextProjectId,
      name: `${source.name} copia`,
      isPublic: false,
      pages: source.pages.map((page) => {
        const nextPageId = pageIdBySource.get(page.id) ?? crypto.randomUUID();
        return {
          ...page,
          id: nextPageId,
          projectId: nextProjectId,
          widgets: page.widgets.map((widget) => ({
            ...widget,
            id: crypto.randomUUID(),
            projectId: nextProjectId,
            pageId: nextPageId,
            createdAt: now,
            updatedAt: now,
          })),
          createdAt: now,
          updatedAt: now,
        };
      }),
      datasets: source.datasets.map((dataset) => ({ ...dataset, projectId: nextProjectId, createdAt: now, updatedAt: now })),
      createdAt: now,
      updatedAt: now,
    };

    await this.saveReport(report);
    return report;
  },

  async getReportByProjectId(projectId: string) {
    if (!enabled()) return readLocal(projectId);

    const supabase = createClient();
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle<DbReport>();
    if (reportError) throw reportError;
    if (!report) return null;

    const [{ data: pages, error: pagesError }, { data: datasets, error: datasetsError }, { data: widgets, error: widgetsError }] = await Promise.all([
      supabase.from("report_pages").select("*").eq("project_id", projectId),
      supabase.from("datasets").select("*").eq("project_id", projectId),
      supabase.from("widgets").select("*").eq("project_id", projectId),
    ]);

    if (pagesError) throw pagesError;
    if (datasetsError) throw datasetsError;
    if (widgetsError) throw widgetsError;

    return mapReport(report, (pages ?? []) as DbPage[], (datasets ?? []) as DbDataset[], (widgets ?? []) as DbWidget[]);
  },

  async saveReport(report: Report) {
    if (!enabled()) {
      persistLocal(report);
      return report;
    }

    const supabase = createClient();
    const { error } = await supabase.from("reports").upsert({
      id: report.id,
      project_id: report.projectId,
      name: report.name,
      is_public: report.isPublic,
      theme: report.theme,
      data_model: report.dataModel ?? { relationships: [] },
      updated_at: new Date().toISOString(),
    }, { onConflict: "project_id" });
    if (error) throw error;
    await this.deleteMissingChildren(report);
    await Promise.all([
      ...report.pages.map((page) => this.savePage(page)),
      ...report.datasets.map((dataset) => this.saveDataset(report.projectId, dataset)),
      ...report.pages.flatMap((page) => page.widgets.map((widget) => this.saveWidget(widget))),
    ]);
    return report;
  },

  async savePage(page: ReportPage) {
    if (!enabled()) return page;
    const supabase = createClient();
    const { error } = await supabase.from("report_pages").upsert({
      id: page.id,
      project_id: page.projectId,
      name: page.name,
      order_index: page.orderIndex,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return page;
  },

  async saveWidget(widget: ReportWidget) {
    if (!enabled()) return widget;
    const supabase = createClient();
    const { error } = await supabase.from("widgets").upsert({
      id: widget.id,
      project_id: widget.projectId,
      page_id: widget.pageId,
      type: widget.type,
      layout: { x: widget.x, y: widget.y, w: widget.w, h: widget.h },
      config: widget.config,
      style: widget.style,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return widget;
  },

  async saveDataset(projectId: string, dataset: Dataset) {
    if (!enabled()) return dataset;
    const supabase = createClient();
    const { error } = await supabase.from("datasets").upsert({
      id: dataset.id,
      project_id: projectId,
      name: dataset.name,
      source_type: dataset.sourceType === "unknown" ? "manual" : dataset.sourceType,
      source_url: dataset.sourceUrl,
      columns: dataset.columns,
      column_config: dataset.columnConfig ?? [],
      calculated_fields: dataset.calculatedFields ?? [],
      rows: dataset.rows,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return dataset;
  },

  async deleteMissingChildren(report: Report) {
    if (!enabled()) return;

    const supabase = createClient();
    const pageIds = report.pages.map((page) => page.id);
    const datasetIds = report.datasets.map((dataset) => dataset.id);
    const widgetIds = report.pages.flatMap((page) => page.widgets.map((widget) => widget.id));

    const deletions = [];
    if (pageIds.length) {
      deletions.push(supabase.from("report_pages").delete().eq("project_id", report.projectId).not("id", "in", `(${pageIds.join(",")})`));
    }
    if (datasetIds.length) {
      deletions.push(supabase.from("datasets").delete().eq("project_id", report.projectId).not("id", "in", `(${datasetIds.join(",")})`));
    } else {
      deletions.push(supabase.from("datasets").delete().eq("project_id", report.projectId));
    }
    if (widgetIds.length) {
      deletions.push(supabase.from("widgets").delete().eq("project_id", report.projectId).not("id", "in", `(${widgetIds.join(",")})`));
    } else {
      deletions.push(supabase.from("widgets").delete().eq("project_id", report.projectId));
    }

    const results = await Promise.all(deletions);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
  },
};
