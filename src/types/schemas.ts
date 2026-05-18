import { z } from "zod";
import type { ChartConfig, Dataset, WidgetStyle } from "@/types";

export const columnTypeSchema = z.enum(["text", "number", "date", "boolean"]);
export const columnFormatSchema = z.enum(["text", "number", "currency", "percent", "date"]);
export const aggregationTypeSchema = z.enum(["none", "sum", "avg", "min", "max", "count", "countDistinct"]);
export const aggregationSchema = z.enum(["sum", "avg", "count", "countDistinct", "min", "max"]);
export const widgetTypeSchema = z.enum([
  "bar",
  "horizontal_bar",
  "stacked_bar",
  "line",
  "multi_line",
  "pie",
  "donut",
  "area",
  "combo",
  "scatter",
  "table",
  "pivot_table",
  "kpi",
  "scorecard",
  "text",
  "image",
  "control_text",
  "control_date",
  "control_select",
]);

export const layoutItemSchema = z.object({
  x: z.coerce.number().int().min(0),
  y: z.coerce.number().int().min(0),
  w: z.coerce.number().int().min(1).max(12),
  h: z.coerce.number().int().min(1),
});

export const datasetColumnSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: columnTypeSchema,
});

export const datasetColumnConfigSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: columnTypeSchema,
  format: columnFormatSchema,
  defaultAggregation: aggregationTypeSchema,
  visible: z.boolean(),
  isCalculated: z.boolean().optional(),
  formula: z.string().optional(),
});

export const widgetFilterSchema = z.object({
  column: z.string().min(1),
  operator: z.enum(["contains", "notContains", "equals", "notEquals", "gte", "lte", "between", "isNull", "notNull"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.tuple([z.string(), z.string()])]),
});

export const widgetMetricSchema = z.object({
  id: z.string().min(1),
  column: z.string().optional(),
  label: z.string().min(1),
  aggregation: aggregationSchema,
});

export const widgetConfigSchema: z.ZodType<ChartConfig> = z.object({
  datasetId: z.string().optional(),
  baseDatasetId: z.string().optional(),
  dimension: z.string().optional(),
  dimensions: z.array(z.string()).optional(),
  drillDimensions: z.array(z.string()).optional(),
  drillLevel: z.coerce.number().int().min(0).optional(),
  metric: z.string().optional(),
  metrics: z.array(z.union([z.string(), widgetMetricSchema])).optional(),
  optionalMetrics: z.array(z.union([z.string(), widgetMetricSchema])).optional(),
  activeOptionalMetric: z.string().optional(),
  aggregation: aggregationSchema,
  filters: z.array(widgetFilterSchema),
  globalFilters: z.array(widgetFilterSchema).optional(),
  pageFilters: z.array(widgetFilterSchema).optional(),
  reportFilters: z.array(widgetFilterSchema).optional(),
  enableCrossFilter: z.boolean().optional(),
  calculatedFields: z.array(z.any()).optional(),
  orderBy: z.string().optional(),
  orderDirection: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const widgetStyleSchema: z.ZodType<WidgetStyle> = z.object({
  title: z.string().optional(),
  showTitle: z.boolean().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.coerce.number().min(8).max(72).optional(),
  color: z.string().optional(),
  background: z.string().optional(),
  borderColor: z.string().optional(),
  borderRadius: z.coerce.number().min(0).max(64).optional(),
  showLegend: z.boolean().optional(),
  seriesColors: z.array(z.string()).optional(),
  lineWidth: z.coerce.number().min(1).max(12).optional(),
  barRadius: z.coerce.number().min(0).max(24).optional(),
  pieInnerRadius: z.coerce.number().min(0).max(90).optional(),
  pieOuterRadius: z.coerce.number().min(1).max(100).optional(),
  showDataLabels: z.boolean().optional(),
  showPiePercent: z.boolean().optional(),
  stackSeries: z.boolean().optional(),
  imageUrl: z.string().url().or(z.literal("")).optional(),
  text: z.string().optional(),
});

export const reportThemeSchema = z.object({
  name: z.string().min(1),
  canvasBackground: z.string().min(1),
  pageBackground: z.string().min(1),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Usa un color hexadecimal válido."),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Usa un color hexadecimal válido."),
  text: z.string().min(1),
  fontFamily: z.string().min(1),
});

export const datasetSchema: z.ZodType<Dataset> = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  ownerId: z.string().optional(),
  name: z.string().min(1, "El nombre es obligatorio."),
  sourceType: z.enum(["csv", "google_sheets", "manual", "unknown"]),
  sourceUrl: z.string().url().nullable().optional(),
  columns: z.array(datasetColumnSchema),
  columnConfig: z.array(datasetColumnConfigSchema).optional(),
  calculatedFields: z.array(z.any()).optional(),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const widgetSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  pageId: z.string().min(1),
  type: widgetTypeSchema,
  x: z.coerce.number().int().min(0),
  y: z.coerce.number().int().min(0),
  w: z.coerce.number().int().min(1).max(12),
  h: z.coerce.number().int().min(1),
  locked: z.boolean().optional(),
  config: widgetConfigSchema,
  style: widgetStyleSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
