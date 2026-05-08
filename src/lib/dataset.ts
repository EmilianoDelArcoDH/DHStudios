import Papa from "papaparse";
import { v4 as uuid } from "uuid";
import type { Aggregation, ColumnType, Dataset, DatasetColumn, DatasetRow, WidgetFilter } from "@/types";

const numberLike = (value: unknown) => value !== "" && value !== null && !Number.isNaN(Number(value));

export function inferColumnType(values: unknown[]): ColumnType {
  const present = values.filter((value) => value !== "" && value !== null && value !== undefined);
  if (present.length === 0) return "text";
  if (present.every((value) => value === "true" || value === "false" || typeof value === "boolean")) return "boolean";
  if (present.every(numberLike)) return "number";
  if (present.every((value) => !Number.isNaN(Date.parse(String(value))))) return "date";
  return "text";
}

export function normalizeRows(rows: Record<string, unknown>[], columns: DatasetColumn[]): DatasetRow[] {
  return rows.map((row) => {
    const next: DatasetRow = {};
    columns.forEach((column) => {
      const value = row[column.name];
      if (column.type === "number") next[column.name] = numberLike(value) ? Number(value) : null;
      else if (column.type === "boolean") next[column.name] = value === true || String(value).toLowerCase() === "true";
      else next[column.name] = value === undefined || value === "" ? null : String(value);
    });
    return next;
  });
}

export function parseCsvDataset(name: string, csv: string, sourceType: Dataset["sourceType"] = "csv", sourceUrl?: string, projectId = ""): Dataset {
  const parsed = Papa.parse<Record<string, unknown>>(csv, { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (parsed.errors.length) throw new Error(parsed.errors[0]?.message ?? "No se pudo leer el CSV.");
  const rawRows = parsed.data;
  const keys = Object.keys(rawRows[0] ?? {});
  const columns = keys.map((key) => ({
    id: uuid(),
    name: key.trim(),
    type: inferColumnType(rawRows.map((row) => row[key])),
  }));

  const timestamp = new Date().toISOString();
  return {
    id: uuid(),
    projectId,
    name,
    sourceType,
    sourceUrl,
    columns,
    rows: normalizeRows(rawRows, columns),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function fetchPublishedCsv(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("No se pudo descargar la fuente publicada.");
  return response.text();
}

export function applyFilters(rows: DatasetRow[], filters: WidgetFilter[]) {
  return rows.filter((row) =>
    filters.every((filter) => {
      const value = row[filter.column];
      if (filter.operator === "contains") return String(value ?? "").toLowerCase().includes(String(filter.value).toLowerCase());
      if (filter.operator === "equals") return String(value ?? "") === String(filter.value);
      if (filter.operator === "gte") return Number(value) >= Number(filter.value);
      if (filter.operator === "lte") return Number(value) <= Number(filter.value);
      if (filter.operator === "between" && Array.isArray(filter.value)) {
        const current = new Date(String(value)).getTime();
        return current >= new Date(filter.value[0]).getTime() && current <= new Date(filter.value[1]).getTime();
      }
      return true;
    }),
  );
}

export function aggregate(values: unknown[], aggregation: Aggregation) {
  const nums = values.map(Number).filter((value) => !Number.isNaN(value));
  if (aggregation === "count") return values.length;
  if (nums.length === 0) return 0;
  if (aggregation === "avg") return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (aggregation === "min") return Math.min(...nums);
  if (aggregation === "max") return Math.max(...nums);
  return nums.reduce((a, b) => a + b, 0);
}

export function buildSeries(dataset: Dataset | undefined, config: { dimension?: string; metric?: string; aggregation: Aggregation; filters: WidgetFilter[]; limit?: number; orderDirection?: "asc" | "desc" }) {
  if (!dataset) return [];
  const rows = applyFilters(dataset.rows, config.filters ?? []);
  if (!config.dimension) {
    return [{ label: config.metric ?? "registros", value: aggregate(rows.map((row) => (config.metric ? row[config.metric] : 1)), config.aggregation) }];
  }

  const groups = new Map<string, unknown[]>();
  rows.forEach((row) => {
    const key = String(row[config.dimension!] ?? "Sin valor");
    groups.set(key, [...(groups.get(key) ?? []), config.metric ? row[config.metric] : 1]);
  });

  return Array.from(groups.entries())
    .map(([label, values]) => ({ label, value: aggregate(values, config.aggregation) }))
    .sort((a, b) => (config.orderDirection === "desc" ? b.value - a.value : a.label.localeCompare(b.label)))
    .slice(0, config.limit ?? 50);
}
