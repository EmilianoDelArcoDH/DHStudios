import type { Report, ReportExport } from "@/types";

export function exportReport(report: Report): string {
  const payload: ReportExport = { version: 1, exportedAt: new Date().toISOString(), report };
  return JSON.stringify(payload, null, 2);
}

export function importReport(json: string): Report {
  const payload = JSON.parse(json) as ReportExport;
  if (payload.version !== 1 || !payload.report?.pages || !payload.report?.datasets) {
    throw new Error("El JSON no tiene formato de reporte válido.");
  }
  const projectId = payload.report.projectId ?? crypto.randomUUID();
  return {
    ...payload.report,
    projectId,
    pages: payload.report.pages.map((page) => ({
      ...page,
      projectId,
      widgets: page.widgets.map((widget) => ({ ...widget, projectId })),
    })),
    datasets: payload.report.datasets.map((dataset) => ({ ...dataset, projectId })),
  };
}
