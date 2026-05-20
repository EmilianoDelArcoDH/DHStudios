"use client";

import type { Dataset, Report, ReportPage, ReportWidget } from "@/types";
import { createDemoReport, createEmptyReport } from "@/lib/demo-data";

const storageKey = (projectId: string) => `dh-project:${projectId}`;
const workspaceKey = "dh-projects:index";
const editorKeyStorageKey = (projectId: string) => `dh-project-editor-key:${projectId}`;

export type ProjectTemplate = "En blanco" | "Comercial";
export type ProjectSummary = {
  projectId: string;
  name: string;
  updatedAt: string;
  pageCount: number;
  isPublic: boolean;
  thumbnail?: string;
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
  if (template === "Comercial") {
    const report = createDemoReport();
    return { ...report, name: name || report.name, updatedAt: new Date().toISOString() };
  }

  return createEmptyReport(undefined, name || "Proyecto sin titulo");
}

function readEditorKey(projectId: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(editorKeyStorageKey(projectId));
}

function writeEditorKey(projectId: string, editorKey: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(editorKeyStorageKey(projectId), editorKey);
}

async function readRemote(projectId: string, options?: { publicOnly?: boolean }) {
  const headers: Record<string, string> = {};
  if (!options?.publicOnly) {
    const editorKey = readEditorKey(projectId);
    if (editorKey) headers["x-editor-key"] = editorKey;
  }

  const search = options?.publicOnly ? "?public=1" : "";
  const response = await fetch(`/api/reports/${projectId}${search}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? "No se pudo cargar el proyecto.");
  }

  const payload = await response.json() as { report: Report };
  persistLocal(payload.report);
  return payload.report;
}

async function writeRemote(report: Report) {
  const editorKey = readEditorKey(report.projectId);
  const response = await fetch(`/api/reports/${report.projectId}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...(editorKey ? { "x-editor-key": editorKey } : {}),
    },
    body: JSON.stringify({ report }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? "No se pudo guardar el proyecto.");
  }

  const payload = await response.json() as { report: Report; editorKey: string };
  writeEditorKey(report.projectId, payload.editorKey);
  persistLocal(payload.report);
  return payload.report;
}

export const reportService = {
  isEnabled: () => true,

  async createProject(name = "Proyecto sin titulo", template: ProjectTemplate = "En blanco") {
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

  async getReportByProjectId(projectId: string, options?: { publicOnly?: boolean }) {
    const local = !options?.publicOnly ? readLocal(projectId) : null;
    if (local) return local;

    try {
      return await readRemote(projectId, options);
    } catch {
      return local;
    }
  },

  async saveReport(report: Report) {
    try {
      return await writeRemote(report);
    } catch (error) {
      persistLocal(report);
      if (readEditorKey(report.projectId)) throw error;
      return report;
    }
  },

  async savePage(page: ReportPage) {
    const report = await this.getReportByProjectId(page.projectId);
    if (!report) throw new Error("No se encontro el proyecto para guardar la pagina.");
    return this.saveReport({
      ...report,
      pages: report.pages.some((current) => current.id === page.id)
        ? report.pages.map((current) => (current.id === page.id ? page : current))
        : [...report.pages, page],
      updatedAt: new Date().toISOString(),
    });
  },

  async saveWidget(widget: ReportWidget) {
    const report = await this.getReportByProjectId(widget.projectId);
    if (!report) throw new Error("No se encontro el proyecto para guardar el widget.");
    return this.saveReport({
      ...report,
      pages: report.pages.map((page) => page.id === widget.pageId
        ? {
          ...page,
          widgets: page.widgets.some((current) => current.id === widget.id)
            ? page.widgets.map((current) => (current.id === widget.id ? widget : current))
            : [...page.widgets, widget],
        }
        : page),
      updatedAt: new Date().toISOString(),
    });
  },

  async saveDataset(projectId: string, dataset: Dataset) {
    const report = await this.getReportByProjectId(projectId);
    if (!report) throw new Error("No se encontro el proyecto para guardar el dataset.");
    return this.saveReport({
      ...report,
      datasets: report.datasets.some((current) => current.id === dataset.id)
        ? report.datasets.map((current) => (current.id === dataset.id ? dataset : current))
        : [...report.datasets, dataset],
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteMissingChildren() {
    return undefined;
  },
};
