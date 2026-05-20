import type { Dataset, DatasetRow } from "@/types";
import { aggregate, isRecordCountMetric } from "@/lib/dataset";
import { joinDatasets } from "./join";
import { fieldKey, type DataModel, type WidgetQuery } from "./types";

export type QueryResult = {
  dimensions: string[];
  metrics: string[];
  categories: string[];
  series: { name: string; data: number[] }[];
  rows: DatasetRow[];
};

export function executeWidgetQuery(query: WidgetQuery, datasets: Dataset[], dataModel?: DataModel): QueryResult {
  const baseDataset = datasets.find((dataset) => dataset.id === query.baseDatasetId);
  const dimensions = query.dimensions.map(fieldKey);
  const metrics = query.metrics.map(fieldKey);

  if (!baseDataset) return { dimensions, metrics, categories: [], series: [], rows: [] };

  const rows = joinDatasets(baseDataset, datasets, dataModel) as DatasetRow[];
  const groups = new Map<string, DatasetRow[]>();

  rows.forEach((row) => {
    const label = dimensions.length
      ? dimensions.map((dimension) => String(row[dimension] ?? "Sin valor")).join(" - ")
      : "Total";
    groups.set(label, [...(groups.get(label) ?? []), row]);
  });

  const categories = Array.from(groups.keys()).slice(0, query.limit ?? Number.MAX_SAFE_INTEGER);
  const series = (metrics.length ? metrics : [`${query.baseDatasetId}.__count`]).map((metric) => ({
    name: metric,
    data: categories.map((category) => {
      const groupedRows = groups.get(category) ?? [];
      const values = metric.endsWith(".__count") ? groupedRows.map(() => 1) : groupedRows.map((row) => row[metric]);
      return aggregate(values, metric.endsWith(".__count") ? "count" : query.aggregation);
    }),
  }));

  if (query.orderDirection === "desc" && series[0]) {
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

  return { dimensions, metrics, categories, series, rows };
}

export function queryFieldFromKey(key: string, fallbackDatasetId: string) {
  if (isRecordCountMetric(key)) return { datasetId: fallbackDatasetId, column: "__count" };
  const separator = key.indexOf(".");
  if (separator === -1) return { datasetId: fallbackDatasetId, column: key };
  return { datasetId: key.slice(0, separator), column: key.slice(separator + 1) };
}
