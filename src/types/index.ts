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
  | "pivot_table"
  | "kpi"
  | "scorecard"
  | "text"
  | "image"
  | "control_text"
  | "control_date"
  | "control_select";
export type Aggregation = "sum" | "avg" | "count" | "countDistinct" | "min" | "max";
export type ReportMode = "edit" | "view";
export type LegendPosition = "top" | "bottom" | "left" | "right";
export type ValueFormat = "number" | "currency" | "percentage";
export type ChartOrientation = "vertical" | "horizontal";
export type ChartStylePreset = "modern" | "minimal" | "corporate" | "vibrant";
export type DimensionGroupingMode = "none" | "top_n" | "bottom_n";
export type ContentAlign = "left" | "center" | "right";
export type LegendLayout = "auto" | "list";
export type TextAlign = "left" | "center" | "right" | "justify";

export type DatasetColumn = {
  id: ID;
  name: string;
  type: ColumnType;
};

export type DatasetRow = Record<string, string | number | boolean | null>;

export type DataSource = {
  type: Dataset["sourceType"];
  url?: string | null;
  name?: string;
};

export type ColumnDef = DatasetColumnConfig;

export type LayoutItem = {
  x: number;
  y: number;
  w: number;
  h: number;
};

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
  sourceType: "csv" | "xlsx" | "google_sheets" | "manual" | "unknown";
  sourceUrl?: string | null;
  columns: DatasetColumn[];
  columnConfig?: DatasetColumnConfig[];
  calculatedFields?: CalculatedField[];
  rows: DatasetRow[];
  createdAt: string;
  updatedAt: string;
};

export type FilterOperator = "contains" | "notContains" | "equals" | "notEquals" | "gte" | "lte" | "between" | "isNull" | "notNull";

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
  drillDimensions?: string[];
  drillLevel?: number;
  metric?: string;
  metrics?: Array<string | WidgetMetric>;
  optionalMetrics?: Array<string | WidgetMetric>;
  activeOptionalMetric?: string;
  aggregation: Aggregation;
  filters: WidgetFilter[];
  globalFilters?: WidgetFilter[];
  pageFilters?: WidgetFilter[];
  reportFilters?: WidgetFilter[];
  enableCrossFilter?: boolean;
  calculatedFields?: CalculatedField[];
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  limit?: number;
  dimensionGroupingMode?: DimensionGroupingMode;
  groupRemainingAsOthers?: boolean;
  colorPalette?: string[];
  showLegend?: boolean;
  legendPosition?: LegendPosition;
  legendAlign?: ContentAlign;
  legendLayout?: LegendLayout;
  showGrid?: boolean;
  smooth?: boolean;
  stack?: boolean;
  labelShow?: boolean;
  valueFormat?: ValueFormat;
  orientation?: ChartOrientation;
  stylePreset?: ChartStylePreset;
};

export type WidgetConfig = ChartConfig;

export type WidgetStyle = {
  title?: string;
  showTitle?: boolean;
  fontFamily?: string;
  fontSize?: number;
  contentAlign?: ContentAlign;
  textAlign?: TextAlign;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
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
  showHeatmap?: boolean;
  heatmapColor?: string;
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

export interface Widget {
  id: ID;
  type: WidgetType;
  position: LayoutItem;
  config: WidgetConfig;
  data?: DatasetRow[];
}

export type ReportPage = {
  id: ID;
  projectId: ID;
  name: string;
  orderIndex: number;
  filters?: WidgetFilter[];
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
  filters?: WidgetFilter[];
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

export * from "./schemas";
