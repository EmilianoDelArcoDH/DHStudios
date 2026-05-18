import type { ChartStylePreset } from "@/types";

export type ChartPreset = {
  id: ChartStylePreset;
  label: string;
  palette: string[];
  gridColor: string;
  axisColor: string;
  textColor: string;
};

export const chartPresets: Record<ChartStylePreset, ChartPreset> = {
  modern: {
    id: "modern",
    label: "Moderno",
    palette: ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"],
    gridColor: "rgba(100, 116, 139, 0.16)",
    axisColor: "rgba(100, 116, 139, 0.36)",
    textColor: "#475569",
  },
  minimal: {
    id: "minimal",
    label: "Minimalista",
    palette: ["#0f172a", "#64748b", "#94a3b8", "#cbd5e1", "#334155"],
    gridColor: "rgba(148, 163, 184, 0.14)",
    axisColor: "rgba(148, 163, 184, 0.28)",
    textColor: "#64748b",
  },
  corporate: {
    id: "corporate",
    label: "Corporativo",
    palette: ["#1d4ed8", "#0f766e", "#7c3aed", "#c2410c", "#be123c", "#0369a1"],
    gridColor: "rgba(71, 85, 105, 0.18)",
    axisColor: "rgba(71, 85, 105, 0.34)",
    textColor: "#334155",
  },
  vibrant: {
    id: "vibrant",
    label: "Vibrante",
    palette: ["#3333ff", "#00cc7e", "#ffc51a", "#ff7059", "#8a6df1", "#ff76e2", "#00a3ff"],
    gridColor: "rgba(99, 102, 241, 0.16)",
    axisColor: "rgba(99, 102, 241, 0.34)",
    textColor: "#4b5563",
  },
};

export const defaultChartPreset = chartPresets.modern;
