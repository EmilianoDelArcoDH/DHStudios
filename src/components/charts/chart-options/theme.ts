import type { ChartConfig, WidgetStyle } from "@/types";
import { chartPresets, defaultChartPreset } from "./presets";

export function getChartPalette(config: ChartConfig, style: WidgetStyle) {
  if (config.colorPalette?.length) return config.colorPalette;
  if (style.seriesColors?.length) return style.seriesColors;
  return chartPresets[config.stylePreset ?? "modern"]?.palette ?? defaultChartPreset.palette;
}

export function getChartTheme(config: ChartConfig) {
  const preset = chartPresets[config.stylePreset ?? "modern"] ?? defaultChartPreset;
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  if (!isDark) return preset;

  return {
    ...preset,
    gridColor: "rgba(148, 163, 184, 0.14)",
    axisColor: "rgba(148, 163, 184, 0.28)",
    textColor: "#cbd5e1",
  };
}

export function formatChartValue(value: unknown, format: ChartConfig["valueFormat"] = "number") {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return String(value ?? "");

  if (format === "currency") {
    return Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      notation: Math.abs(number) >= 1000 ? "compact" : "standard",
      maximumFractionDigits: Math.abs(number) >= 1000 ? 1 : 0,
    }).format(number);
  }

  if (format === "percentage") {
    return Intl.NumberFormat("es-AR", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(number > 1 ? number / 100 : number);
  }

  return Intl.NumberFormat("es-AR", {
    notation: Math.abs(number) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(number) >= 1000 ? 1 : 2,
  }).format(number);
}
