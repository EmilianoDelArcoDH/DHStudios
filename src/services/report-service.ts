"use client";

import type { Dataset, Report, ReportPage, ReportWidget, WidgetType } from "@/types";
import { createEmptyReport } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/client";

const enabled = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const storageKey = (projectId: string) => `dh-project:${projectId}`;

type DbReport = {
  id?: string;
  project_id: string;
  owner_id?: string;
  name: string;
  is_public: boolean;
  theme: Report["theme"];
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
}

function readLocal(projectId: string) {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(storageKey(projectId));
  return value ? (JSON.parse(value) as Report) : null;
}

function mapReport(report: DbReport, pages: DbPage[], datasets: DbDataset[], widgets: DbWidget[]): Report {
  return {
    id: report.id,
    projectId: report.project_id,
    ownerId: report.owner_id,
    name: report.name,
    isPublic: report.is_public,
    theme: report.theme,
    datasets: datasets.map((dataset) => ({
      id: dataset.id,
      projectId: dataset.project_id,
      ownerId: dataset.owner_id,
      name: dataset.name,
      sourceType: dataset.source_type,
      sourceUrl: dataset.source_url,
      columns: dataset.columns,
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

  async createProject(name = "Proyecto sin título") {
    const report = createEmptyReport(crypto.randomUUID(), name);
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
      updated_at: new Date().toISOString(),
    }, { onConflict: "project_id" });
    if (error) throw error;
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
      source_type: dataset.sourceType,
      source_url: dataset.sourceUrl,
      columns: dataset.columns,
      rows: dataset.rows,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return dataset;
  },
};
