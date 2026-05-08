import type { Dataset, Report, ReportTheme, ReportWidget, WidgetType } from "@/types";

export const defaultTheme: ReportTheme = {
  name: "Claro editorial",
  canvasBackground: "#eef0f3",
  pageBackground: "#ffffff",
  primary: "#3333ff",
  accent: "#14b8a6",
  text: "#1f2937",
  fontFamily: "Geist",
};

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

export function createDemoDataset(projectId = ""): Dataset {
  return {
    id: newId(),
    projectId,
    name: "Ventas demo",
    sourceType: "manual",
    columns: [
      { id: newId(), name: "mes", type: "text" },
      { id: newId(), name: "region", type: "text" },
      { id: newId(), name: "ventas", type: "number" },
      { id: newId(), name: "objetivo", type: "number" },
      { id: newId(), name: "fecha", type: "date" },
    ],
    rows: [
      { mes: "Ene", region: "Norte", ventas: 12400, objetivo: 11000, fecha: "2026-01-01" },
      { mes: "Feb", region: "Norte", ventas: 13800, objetivo: 12000, fecha: "2026-02-01" },
      { mes: "Mar", region: "Sur", ventas: 9300, objetivo: 10000, fecha: "2026-03-01" },
      { mes: "Abr", region: "Sur", ventas: 15100, objetivo: 13000, fecha: "2026-04-01" },
      { mes: "May", region: "Centro", ventas: 16750, objetivo: 14500, fecha: "2026-05-01" },
    ],
    createdAt: now(),
    updatedAt: now(),
  };
}

function widget(type: WidgetType, projectId: string, pageId: string, x: number, y: number, w: number, h: number, datasetId: string, title: string): ReportWidget {
  return {
    id: newId(),
    projectId,
    pageId,
    type,
    x,
    y,
    w,
    h,
    config: {
      datasetId,
      dimension: type === "kpi" || type === "scorecard" ? undefined : "mes",
      dimensions: type === "kpi" || type === "scorecard" ? [] : ["mes"],
      metric: "ventas",
      metrics: ["ventas"],
      aggregation: "sum",
      filters: [],
      orderBy: "mes",
      orderDirection: "asc",
      limit: 20,
    },
    style: {
      title,
      fontFamily: "Geist",
      fontSize: 13,
      color: "#1f2937",
      background: "#ffffff",
      borderColor: "#d7dce2",
      borderRadius: 4,
      showLegend: true,
      seriesColors: ["#3333ff", "#00cc7e", "#ffc51a", "#ff7059", "#8a6df1", "#ff76e2"],
      lineWidth: 2,
      barRadius: 3,
      pieInnerRadius: 0,
      pieOuterRadius: 58,
      showDataLabels: false,
      showPiePercent: false,
      stackSeries: type === "stacked_bar",
    },
    createdAt: now(),
    updatedAt: now(),
  };
}

export function createEmptyReport(projectId = newId(), name = "Proyecto sin título"): Report {
  const pageId = newId();
  return {
    projectId,
    name,
    isPublic: false,
    theme: defaultTheme,
    datasets: [],
    pages: [
      {
        id: pageId,
        projectId,
        name: "Página 1",
        orderIndex: 0,
        widgets: [],
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    createdAt: now(),
    updatedAt: now(),
  };
}

export function createDemoReport(projectId = newId()): Report {
  const dataset = createDemoDataset(projectId);
  const pageId = newId();
  const widgets = [
    widget("scorecard", projectId, pageId, 0, 0, 3, 3, dataset.id, "Ventas totales"),
    widget("bar", projectId, pageId, 3, 0, 5, 6, dataset.id, "Ventas por mes"),
    widget("line", projectId, pageId, 8, 0, 4, 6, dataset.id, "Tendencia"),
    widget("table", projectId, pageId, 0, 3, 3, 6, dataset.id, "Detalle"),
  ];

  return {
    projectId,
    name: "Informe comercial",
    isPublic: false,
    theme: defaultTheme,
    datasets: [dataset],
    pages: [
      {
        id: pageId,
        projectId,
        name: "Página 1",
        orderIndex: 0,
        widgets,
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    createdAt: now(),
    updatedAt: now(),
  };
}
