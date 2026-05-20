import type { ChartConfig, Report, ReportExport, WidgetFilter, WidgetMetric } from "@/types";

export function exportReport(report: Report): string {
  const payload: ReportExport = { version: 1, exportedAt: new Date().toISOString(), report };
  return JSON.stringify(payload, null, 2);
}

export function importReport(json: string, options?: { projectId?: string }): Report {
  const payload = JSON.parse(json) as ReportExport;
  if (payload.version !== 1 || !payload.report?.pages || !payload.report?.datasets) {
    throw new Error("El JSON no tiene formato de reporte valido.");
  }

  const projectId = options?.projectId ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const datasetIdMap = new Map(payload.report.datasets.map((dataset) => [dataset.id, crypto.randomUUID()]));
  const pageIdMap = new Map(payload.report.pages.map((page) => [page.id, crypto.randomUUID()]));

  const remapFieldKey = (value?: string) => {
    if (!value) return value;
    const separator = value.indexOf(".");
    if (separator === -1) return value;
    const datasetId = value.slice(0, separator);
    const column = value.slice(separator + 1);
    return `${datasetIdMap.get(datasetId) ?? datasetId}.${column}`;
  };

  const remapFilter = (filter: WidgetFilter): WidgetFilter => ({
    ...filter,
    column: remapFieldKey(filter.column) ?? filter.column,
  });

  const remapMetric = (metric: string | WidgetMetric): string | WidgetMetric => {
    if (typeof metric === "string") return remapFieldKey(metric) ?? metric;
    return {
      ...metric,
      id: remapFieldKey(metric.id) ?? metric.id,
      column: remapFieldKey(metric.column),
    };
  };

  const remapConfig = (config: ChartConfig): ChartConfig => ({
    ...config,
    datasetId: config.datasetId ? (datasetIdMap.get(config.datasetId) ?? config.datasetId) : undefined,
    baseDatasetId: config.baseDatasetId ? (datasetIdMap.get(config.baseDatasetId) ?? config.baseDatasetId) : undefined,
    dimension: remapFieldKey(config.dimension),
    dimensions: config.dimensions?.map((value) => remapFieldKey(value) ?? value),
    drillDimensions: config.drillDimensions?.map((value) => remapFieldKey(value) ?? value),
    metric: remapFieldKey(config.metric),
    metrics: config.metrics?.map(remapMetric),
    optionalMetrics: config.optionalMetrics?.map(remapMetric),
    filters: (config.filters ?? []).map(remapFilter),
    globalFilters: config.globalFilters?.map(remapFilter),
    pageFilters: config.pageFilters?.map(remapFilter),
    reportFilters: config.reportFilters?.map(remapFilter),
  });

  return {
    ...payload.report,
    id: undefined,
    ownerId: undefined,
    projectId,
    isPublic: false,
    filters: (payload.report.filters ?? []).map(remapFilter),
    createdAt: now,
    updatedAt: now,
    datasets: payload.report.datasets.map((dataset) => ({
      ...dataset,
      id: datasetIdMap.get(dataset.id) ?? crypto.randomUUID(),
      projectId,
      ownerId: undefined,
      createdAt: now,
      updatedAt: now,
    })),
    dataModel: {
      relationships: (payload.report.dataModel?.relationships ?? []).map((relationship) => ({
        ...relationship,
        id: crypto.randomUUID(),
        fromDatasetId: datasetIdMap.get(relationship.fromDatasetId) ?? relationship.fromDatasetId,
        toDatasetId: datasetIdMap.get(relationship.toDatasetId) ?? relationship.toDatasetId,
      })),
    },
    pages: payload.report.pages.map((page) => {
      const nextPageId = pageIdMap.get(page.id) ?? crypto.randomUUID();
      return {
        ...page,
        id: nextPageId,
        projectId,
        filters: (page.filters ?? []).map(remapFilter),
        createdAt: now,
        updatedAt: now,
        widgets: page.widgets.map((widget) => ({
          ...widget,
          id: crypto.randomUUID(),
          projectId,
          pageId: nextPageId,
          config: remapConfig(widget.config),
          createdAt: now,
          updatedAt: now,
        })),
      };
    }),
  };
}
