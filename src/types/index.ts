export type ID = string;

export type ColumnType = "text" | "number" | "date" | "boolean";
export type WidgetType =
  | "bar"
  | "line"
  | "pie"
  | "area"
  | "table"
  | "kpi"
  | "scorecard"
  | "text"
  | "image"
  | "control_text"
  | "control_date"
  | "control_select";
export type Aggregation = "sum" | "avg" | "count" | "min" | "max";
export type ReportMode = "edit" | "view";

export type DatasetColumn = {
  id: ID;
  name: string;
  type: ColumnType;
};

export type DatasetRow = Record<string, string | number | boolean | null>;

export type Dataset = {
  id: ID;
  projectId: ID;
  ownerId?: ID;
  name: string;
  sourceType: "csv" | "google_sheets" | "manual";
  sourceUrl?: string | null;
  columns: DatasetColumn[];
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

export type ChartConfig = {
  datasetId?: ID;
  dimension?: string;
  metric?: string;
  aggregation: Aggregation;
  filters: WidgetFilter[];
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
  createdAt: string;
  updatedAt: string;
};

export type ReportExport = {
  version: 1;
  exportedAt: string;
  report: Report;
};
