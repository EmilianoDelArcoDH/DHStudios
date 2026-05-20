import Papa from "papaparse";
import { read, utils } from "xlsx";
import { v4 as uuid } from "uuid";
import type {
  Aggregation,
  AggregationType,
  CalculatedField,
  ColumnFormat,
  ColumnType,
  Dataset,
  DatasetColumn,
  DatasetColumnConfig,
  DatasetRow,
  WidgetFilter,
  WidgetMetric,
} from "@/types";

export const RECORD_COUNT_METRIC = "__record_count";
export const RECORD_COUNT_LABEL = "Record Count";

const numberLike = (value: unknown) => value !== "" && value !== null && !Number.isNaN(Number(value));
const aggregationValues: Aggregation[] = ["sum", "avg", "min", "max", "count", "countDistinct"];
const booleanLike = (value: unknown) => {
  const normalized = String(value).toLowerCase();
  return normalized === "true" || normalized === "false";
};

export function inferColumnType(values: unknown[]): ColumnType {
  const present = values.filter((value) => value !== "" && value !== null && value !== undefined);
  if (present.length === 0) return "text";
  if (present.every((value) => booleanLike(value) || typeof value === "boolean")) return "boolean";
  if (present.every(numberLike)) return "number";
  if (present.every((value) => value instanceof Date || !Number.isNaN(Date.parse(String(value))))) return "date";
  return "text";
}

function normalizeDateValue(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function normalizeRows(rows: Record<string, unknown>[], columns: DatasetColumn[]): DatasetRow[] {
  return rows.map((row) => {
    const next: DatasetRow = {};
    columns.forEach((column) => {
      const value = row[column.name];
      if (column.type === "number") next[column.name] = numberLike(value) ? Number(value) : null;
      else if (column.type === "boolean") next[column.name] = value === true || String(value).toLowerCase() === "true";
      else if (column.type === "date") next[column.name] = normalizeDateValue(value);
      else next[column.name] = value === undefined || value === "" ? null : String(value);
    });
    return next;
  });
}

function sanitizeRawRows(rows: Record<string, unknown>[]) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row)
        .map(([key, value]) => [key.trim(), value] as const)
        .filter(([key]) => key.length > 0),
    ),
  );
}

function buildDatasetFromRows(
  name: string,
  rawRows: Record<string, unknown>[],
  sourceType: Dataset["sourceType"],
  sourceUrl?: string,
  projectId = "",
): Dataset {
  const rows = sanitizeRawRows(rawRows);
  const keys = Object.keys(rows[0] ?? {});

  if (!keys.length) {
    throw new Error("La fuente no tiene columnas con encabezados legibles.");
  }

  const columns = keys.map((key) => ({
    id: uuid(),
    name: key,
    type: inferColumnType(rows.map((row) => row[key])),
  }));

  const timestamp = new Date().toISOString();
  return {
    id: uuid(),
    projectId,
    name,
    sourceType,
    sourceUrl,
    columns,
    rows: normalizeRows(rows, columns),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function defaultFormatForType(type: ColumnType): ColumnFormat {
  if (type === "number") return "number";
  if (type === "date") return "date";
  return "text";
}

function defaultAggregationForType(type: ColumnType): AggregationType {
  return type === "number" ? "sum" : "none";
}

export function isAggregation(value: AggregationType): value is Aggregation {
  return aggregationValues.includes(value as Aggregation);
}

export function isRecordCountMetric(value?: string) {
  return value === RECORD_COUNT_METRIC || value?.endsWith(".__count") === true;
}

export function aggregationOrFallback(value: AggregationType | undefined, fallback: Aggregation = "sum"): Aggregation {
  return value && isAggregation(value) ? value : fallback;
}

export function getDatasetColumnConfig(dataset: Dataset): DatasetColumnConfig[] {
  const existing = new Map((dataset.columnConfig ?? []).map((config) => [config.name, config]));
  const baseColumns = dataset.columns.map((column) => {
    const config = existing.get(column.name);
    return {
      name: column.name,
      label: config?.label || column.name,
      type: config?.type ?? column.type,
      format: config?.format ?? defaultFormatForType(column.type),
      defaultAggregation: config?.defaultAggregation ?? defaultAggregationForType(column.type),
      visible: config?.visible ?? true,
      isCalculated: false,
      formula: undefined,
    };
  });

  const calculatedColumns = (dataset.calculatedFields ?? []).map((field) => {
    const config = existing.get(field.name);
    return {
      name: field.name,
      label: config?.label || field.label || field.name,
      type: config?.type ?? field.type,
      format: config?.format ?? field.format,
      defaultAggregation: config?.defaultAggregation ?? field.defaultAggregation,
      visible: config?.visible ?? true,
      isCalculated: true,
      formula: field.formula,
    };
  });

  return [...baseColumns, ...calculatedColumns];
}

export function ensureDatasetConfig(dataset: Dataset): Dataset {
  return {
    ...dataset,
    sourceType: dataset.sourceType ?? "unknown",
    columnConfig: getDatasetColumnConfig(dataset),
    calculatedFields: dataset.calculatedFields ?? [],
  };
}

export function getVisibleDatasetColumns(dataset: Dataset): DatasetColumnConfig[] {
  return getDatasetColumnConfig(dataset).filter((column) => column.visible);
}

export function parseCsvDataset(name: string, csv: string, sourceType: Dataset["sourceType"] = "csv", sourceUrl?: string, projectId = ""): Dataset {
  const parsed = Papa.parse<Record<string, unknown>>(csv, { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (parsed.errors.length) throw new Error(parsed.errors[0]?.message ?? "No se pudo leer el CSV.");
  return buildDatasetFromRows(name, parsed.data, sourceType, sourceUrl, projectId);
}

export function parseXlsxDataset(name: string, data: ArrayBuffer, sourceUrl?: string, projectId = ""): Dataset {
  const workbook = read(data, { type: "array", cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("El archivo XLSX no tiene hojas para importar.");

  const worksheet = workbook.Sheets[firstSheet];
  const rawRows = utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: true,
  });

  return buildDatasetFromRows(name, rawRows, "xlsx", sourceUrl, projectId);
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
      if (filter.operator === "notContains") return !String(value ?? "").toLowerCase().includes(String(filter.value).toLowerCase());
      if (filter.operator === "equals") return String(value ?? "") === String(filter.value);
      if (filter.operator === "notEquals") return String(value ?? "") !== String(filter.value);
      if (filter.operator === "gte") return Number(value) >= Number(filter.value);
      if (filter.operator === "lte") return Number(value) <= Number(filter.value);
      if (filter.operator === "isNull") return value === null || value === undefined || value === "";
      if (filter.operator === "notNull") return value !== null && value !== undefined && value !== "";
      if (filter.operator === "between" && Array.isArray(filter.value)) {
        const current = new Date(String(value)).getTime();
        return current >= new Date(filter.value[0]).getTime() && current <= new Date(filter.value[1]).getTime();
      }
      return true;
    }),
  );
}

const hasDistinctValue = (value: unknown) => value !== null && value !== undefined && value !== "";

export function aggregate(values: unknown[], aggregation: Aggregation) {
  if (aggregation === "count") return values.length;
  if (aggregation === "countDistinct") return new Set(values.filter(hasDistinctValue)).size;

  const nums = values.map(Number).filter((value) => !Number.isNaN(value));
  if (nums.length === 0) return 0;
  if (aggregation === "avg") return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (aggregation === "min") return Math.min(...nums);
  if (aggregation === "max") return Math.max(...nums);
  return nums.reduce((a, b) => a + b, 0);
}

type FormulaToken =
  | { type: "number"; value: number }
  | { type: "operator"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" };

type MetricInput = string | WidgetMetric;

export type BuildSeriesV2Config = {
  dimension?: string;
  metric?: string;
  metrics?: MetricInput[];
  aggregation?: Aggregation;
  globalFilters?: WidgetFilter[];
  filters?: WidgetFilter[];
  calculatedFields?: CalculatedField[];
  limit?: number;
  orderDirection?: "asc" | "desc";
};

export type BuildSeriesV2Row = {
  label: string;
  values: Record<string, number>;
};

function metricFromInput(metric: MetricInput, fallbackAggregation: Aggregation): WidgetMetric {
  if (typeof metric !== "string") return metric;
  if (isRecordCountMetric(metric)) return { id: RECORD_COUNT_METRIC, label: RECORD_COUNT_LABEL, aggregation: "count" };
  return { id: metric, column: metric, label: metric, aggregation: fallbackAggregation };
}

function resolveMetrics(config: BuildSeriesV2Config): WidgetMetric[] {
  const fallbackAggregation = config.aggregation ?? "sum";
  const metrics = config.metrics?.filter(Boolean).map((metric) => metricFromInput(metric, fallbackAggregation)) ?? [];
  if (metrics.length) return metrics;
  if (config.metric) return [{ id: config.metric, column: config.metric, label: config.metric, aggregation: fallbackAggregation }];
  return [{ id: RECORD_COUNT_METRIC, label: RECORD_COUNT_LABEL, aggregation: "count" }];
}

function tokenizeFormula(formula: string, row: DatasetRow): FormulaToken[] | undefined {
  const tokens: FormulaToken[] = [];
  let index = 0;

  while (index < formula.length) {
    const char = formula[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const rest = formula.slice(index);
    const numberMatch = rest.match(/^\d+(?:\.\d+)?/);
    if (numberMatch) {
      tokens.push({ type: "number", value: Number(numberMatch[0]) });
      index += numberMatch[0].length;
      continue;
    }

    const identifierMatch = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifierMatch) {
      const rawValue = row[identifierMatch[0]];
      const value = Number(rawValue);
      tokens.push({ type: "number", value: Number.isFinite(value) ? value : 0 });
      index += identifierMatch[0].length;
      continue;
    }

    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }

    return undefined;
  }

  return tokens;
}

export function extractFormulaColumns(formula: string): string[] {
  if (!/^[\w\s+\-*/().]+$/.test(formula)) return [];
  return Array.from(new Set(formula.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []));
}

export function validateCalculatedFieldFormula(dataset: Dataset, formula: string) {
  if (!formula.trim()) return { valid: false, message: "La formula no puede estar vacia." };
  if (!/^[\w\s+\-*/().]+$/.test(formula)) {
    return { valid: false, message: "Usa solo columnas, numeros y operadores + - * / ( )." };
  }

  const availableColumns = new Set([
    ...dataset.columns.map((column) => column.name),
    ...(dataset.calculatedFields ?? []).map((field) => field.name),
  ]);
  const missingColumns = extractFormulaColumns(formula).filter((column) => !availableColumns.has(column));
  if (missingColumns.length) return { valid: false, message: `Columna no encontrada: ${missingColumns.join(", ")}.` };

  return { valid: true, message: "" };
}

function evaluateTokens(tokens: FormulaToken[]) {
  let index = 0;

  const parseExpression = (): number | undefined => {
    let value = parseTerm();
    if (value === undefined) return undefined;

    while (tokens[index]?.type === "operator" && (tokens[index].value === "+" || tokens[index].value === "-")) {
      const operator = tokens[index].value;
      index += 1;
      const nextValue = parseTerm();
      if (nextValue === undefined) return undefined;
      value = operator === "+" ? value + nextValue : value - nextValue;
    }

    return value;
  };

  const parseTerm = (): number | undefined => {
    let value = parseFactor();
    if (value === undefined) return undefined;

    while (tokens[index]?.type === "operator" && (tokens[index].value === "*" || tokens[index].value === "/")) {
      const operator = tokens[index].value;
      index += 1;
      const nextValue = parseFactor();
      if (nextValue === undefined) return undefined;
      value = operator === "*" ? value * nextValue : value / nextValue;
    }

    return value;
  };

  const parseFactor = (): number | undefined => {
    const token = tokens[index];
    if (!token) return undefined;

    if (token.type === "operator" && token.value === "-") {
      index += 1;
      const value = parseFactor();
      return value === undefined ? undefined : -value;
    }

    if (token.type === "number") {
      index += 1;
      return token.value;
    }

    if (token.type === "paren" && token.value === "(") {
      index += 1;
      const value = parseExpression();
      if (tokens[index]?.type !== "paren" || tokens[index].value !== ")") return undefined;
      index += 1;
      return value;
    }

    return undefined;
  };

  const result = parseExpression();
  return result !== undefined && index === tokens.length && Number.isFinite(result) ? result : 0;
}

function calculateFormula(row: DatasetRow, formula: string) {
  if (!/^[\w\s+\-*/().]+$/.test(formula)) return 0;
  const tokens = tokenizeFormula(formula, row);
  if (!tokens?.length) return 0;
  return evaluateTokens(tokens);
}

export function applyCalculatedFields(rows: DatasetRow[], calculatedFields: CalculatedField[] = []): DatasetRow[] {
  if (!calculatedFields.length) return rows;
  return rows.map((row) => {
    const next: DatasetRow = { ...row };
    calculatedFields.forEach((field) => {
      const value = calculateFormula(next, field.formula);
      next[field.id] = value;
      if (field.name && field.name !== field.id) next[field.name] = value;
    });
    return next;
  });
}

export function buildSeriesV2(dataset: Dataset | undefined, config: BuildSeriesV2Config): BuildSeriesV2Row[] {
  if (!dataset) return [];
  const rowsWithCalculatedFields = applyCalculatedFields(dataset.rows, config.calculatedFields ?? []);
  const rows = applyFilters(rowsWithCalculatedFields, [...(config.globalFilters ?? []), ...(config.filters ?? [])]);
  const metrics = resolveMetrics(config);

  if (!config.dimension) {
    return [{
      label: "Total",
      values: Object.fromEntries(metrics.map((metric) => [
        metric.id,
        aggregate(rows.map((row) => (metric.column ? row[metric.column] : 1)), metric.aggregation),
      ])),
    }];
  }

  const groups = new Map<string, DatasetRow[]>();
  rows.forEach((row) => {
    const key = String(row[config.dimension!] ?? "Sin valor");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries())
    .map(([label, groupedRows]) => ({
      label,
      values: Object.fromEntries(metrics.map((metric) => [
        metric.id,
        aggregate(groupedRows.map((row) => (metric.column ? row[metric.column] : 1)), metric.aggregation),
      ])),
    }))
    .sort((a, b) => {
      if (config.orderDirection !== "desc") return a.label.localeCompare(b.label);
      const firstMetric = metrics[0];
      return (b.values[firstMetric.id] ?? 0) - (a.values[firstMetric.id] ?? 0);
    })
    .slice(0, config.limit ?? 50);
}

export function buildSeries(dataset: Dataset | undefined, config: { dimension?: string; metric?: string; aggregation: Aggregation; globalFilters?: WidgetFilter[]; filters?: WidgetFilter[]; limit?: number; orderDirection?: "asc" | "desc" }) {
  const metricId = config.metric ?? RECORD_COUNT_METRIC;
  return buildSeriesV2(dataset, {
    ...config,
    metrics: [isRecordCountMetric(metricId)
      ? { id: RECORD_COUNT_METRIC, label: RECORD_COUNT_LABEL, aggregation: "count" }
      : { id: metricId, column: config.metric, label: metricId, aggregation: config.aggregation }],
  }).map((row) => ({ label: config.dimension ? row.label : metricId, value: row.values[metricId] ?? 0 }));
}
