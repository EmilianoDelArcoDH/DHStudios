export type ID = string;

export type ColumnType = "text" | "number" | "date" | "boolean";
export type ColumnFormat = "text" | "number" | "currency" | "percent" | "date";
export type AggregationType = "none" | "sum" | "avg" | "min" | "max" | "count" | "countDistinct";
export type WidgetType =
  | "bar"
  | "horizontal_bar"
  | "stacked_bar"
  | "line"
  | "multi_line"
  | "pie"
  | "donut"
  | "area"
  | "combo"
  | "scatter"
  | "table"
  | "kpi"
  | "scorecard"
  | "text"
  | "image"
  | "control_text"
  | "control_date"
  | "control_select";
export type Aggregation = "sum" | "avg" | "count" | "countDistinct" | "min" | "max";
export type ReportMode = "edit" | "view";

export type DatasetColumn = {
  id: ID;
  name: string;
  type: ColumnType;
};

export type DatasetRow = Record<string, string | number | boolean | null>;

export type DatasetColumnConfig = {
  name: string;
  label: string;
  type: ColumnType;
  format: ColumnFormat;
  defaultAggregation: AggregationType;
  visible: boolean;
  isCalculated?: boolean;
  formula?: string;
};

export type CalculatedField = {
  id: string;
  name: string;
  label: string;
  formula: string;
  type: ColumnType;
  format: ColumnFormat;
  defaultAggregation: AggregationType;
};

export type Dataset = {
  id: ID;
  projectId: ID;
  ownerId?: ID;
  name: string;
  sourceType: "csv" | "google_sheets" | "manual" | "unknown";
  sourceUrl?: string | null;
  columns: DatasetColumn[];
  columnConfig?: DatasetColumnConfig[];
  calculatedFields?: CalculatedField[];
  rows: DatasetRow[];
  createdAt: string;
  updatedAt: string;
};

export type FilterOperator = "contains" | "equals" | "gte" | "lte" | "between";

export type WidgetFilter = {
  column: string;
  operator: FilterOperator;
  value: string | number | boolean | [string, string];
};

export type WidgetMetric = {
  id: string;
  column?: string;
  label: string;
  aggregation: Aggregation;
};

export type ChartConfig = {
  datasetId?: ID;
  baseDatasetId?: ID;
  dimension?: string;
  dimensions?: string[];
  metric?: string;
  metrics?: Array<string | WidgetMetric>;
  aggregation: Aggregation;
  filters: WidgetFilter[];
  globalFilters?: WidgetFilter[];
  calculatedFields?: CalculatedField[];
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  limit?: number;
};

export type WidgetStyle = {
  title?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  background?: string;
  borderColor?: string;
  borderRadius?: number;
  showLegend?: boolean;
  seriesColors?: string[];
  lineWidth?: number;
  barRadius?: number;
  pieInnerRadius?: number;
  pieOuterRadius?: number;
  showDataLabels?: boolean;
  showPiePercent?: boolean;
  stackSeries?: boolean;
  imageUrl?: string;
  text?: string;
};

export type ReportWidget = {
  id: ID;
  projectId: ID;
  pageId: ID;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  locked?: boolean;
  config: ChartConfig;
  style: WidgetStyle;
  createdAt: string;
  updatedAt: string;
};

export type ReportPage = {
  id: ID;
  projectId: ID;
  name: string;
  orderIndex: number;
  widgets: ReportWidget[];
  createdAt: string;
  updatedAt: string;
};

export type ReportTheme = {
  name: string;
  canvasBackground: string;
  pageBackground: string;
  primary: string;
  accent: string;
  text: string;
  fontFamily: string;
};

export type Report = {
  id?: ID;
  projectId: ID;
  ownerId?: ID;
  name: string;
  isPublic: boolean;
  theme: ReportTheme;
  pages: ReportPage[];
  datasets: Dataset[];
  dataModel?: import("@/lib/data-model/types").DataModel;
  createdAt: string;
  updatedAt: string;
};

export type ReportExport = {
  version: 1;
  exportedAt: string;
  report: Report;
};
