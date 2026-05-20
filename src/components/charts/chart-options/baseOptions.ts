import type { ChartConfig, LegendPosition, WidgetStyle, WidgetType } from "@/types";
import { formatChartValue, getChartTheme } from "./theme";
import { baseChartOptions } from "../chart-options";

export type ChartOption = Record<string, unknown>;

export function getLegendOption(config: ChartConfig, style: WidgetStyle) {
  const show = config.showLegend ?? style.showLegend ?? true;
  const position = config.legendPosition ?? "bottom";
  const layout = config.legendLayout ?? "auto";
  const align = config.legendAlign ?? "center";
  const listMode = layout === "list";
  const fontSize = Math.max(10, (style.fontSize ?? 12) - 1);
  const base = {
    show,
    type: listMode ? "plain" : "scroll",
    icon: "roundRect",
    itemGap: listMode ? 8 : 20,
    itemWidth: 12,
    itemHeight: 8,
    textStyle: {
      fontSize,
      color: getChartTheme(config).textColor,
      align,
      fontWeight: style.fontWeight ?? "normal",
      fontStyle: style.fontStyle ?? "normal",
      textDecoration: style.textDecoration ?? "none",
    },
  };

  return {
    ...base,
    ...legendPlacement(position, align, listMode),
  };
}

export function getGridOption(config: ChartConfig, style: WidgetStyle, chartType?: WidgetType) {
  const showLegend = config.showLegend ?? style.showLegend ?? true;
  const position = config.legendPosition ?? "bottom";
  const listMode = (config.legendLayout ?? "auto") === "list";
  if (!showLegend || position === "bottom") {
    if (chartType === "bar" || chartType === "horizontal_bar" || chartType === "stacked_bar") {
      return { left: "10%", right: "5%", top: "15%", bottom: showLegend ? "12%" : "8%", containLabel: true };
    }

    if (chartType === "line" || chartType === "multi_line" || chartType === "area" || chartType === "combo") {
      return { left: "10%", right: "8%", top: "12%", bottom: showLegend ? "10%" : "8%", containLabel: true };
    }

    return baseChartOptions.grid;
  }

  return {
    top: position === "top" ? "18%" : "12%",
    right: position === "right" ? (listMode ? "26%" : "18%") : "5%",
    bottom: "8%",
    left: position === "left" ? (listMode ? "26%" : "18%") : "8%",
    containLabel: true,
  };
}

export function getAxisStyle(config: ChartConfig, style?: WidgetStyle) {
  const theme = getChartTheme(config);
  const showGrid = config.showGrid ?? true;
  const fontSize = Math.max(10, (style?.fontSize ?? 12) - 1);
  return {
    axisLabel: {
      color: theme.textColor,
      fontSize,
      padding: [5, 0, 0, 0],
      fontWeight: style?.fontWeight ?? "normal",
      fontStyle: style?.fontStyle ?? "normal",
    },
    axisLine: { lineStyle: { color: theme.axisColor } },
    axisTick: { lineStyle: { color: theme.axisColor } },
    splitLine: { show: showGrid, lineStyle: { color: theme.gridColor, type: "dashed" } },
  };
}

export function getTooltipOption(config: ChartConfig, totalByName?: Map<string, number>) {
  return {
    trigger: "axis",
    confine: true,
    appendToBody: true,
    borderWidth: 0,
    borderRadius: 8,
    padding: baseChartOptions.tooltip.padding,
    backgroundColor: baseChartOptions.tooltip.backgroundColor,
    textStyle: { ...baseChartOptions.tooltip.textStyle, fontSize: 12 },
    formatter: (params: unknown) => formatTooltip(params, config, totalByName),
  };
}

export function getPieTooltipOption(config: ChartConfig, total: number) {
  return {
    trigger: "item",
    confine: true,
    appendToBody: true,
    borderWidth: 0,
    borderRadius: 8,
    padding: baseChartOptions.tooltip.padding,
    backgroundColor: baseChartOptions.tooltip.backgroundColor,
    textStyle: { ...baseChartOptions.tooltip.textStyle, fontSize: 12 },
    formatter: (param: unknown) => {
      const item = asTooltipParam(param);
      const value = Number(item?.value ?? 0);
      const percentage = total > 0 ? (value / total) * 100 : 0;
      return tooltipMarkup(String(item?.name ?? ""), [
        {
          marker: item?.marker,
          name: "Valor",
          value: `${formatChartValue(value, config.valueFormat)} (${percentage.toFixed(1).replace(".0", "")}%)`,
        },
      ]);
    },
  };
}

function legendPlacement(position: LegendPosition, align: ChartConfig["legendAlign"], listMode: boolean) {
  if (listMode) {
    if (position === "left") return { left: 8, top: 28, bottom: 12, orient: "vertical" };
    return { right: 8, top: 28, bottom: 12, orient: "vertical" };
  }

  if (position === "top") return { top: 0, left: align === "left" ? 10 : align === "right" ? undefined : "center", right: align === "right" ? 10 : undefined };
  if (position === "left") return { left: 8, top: 28, bottom: 12, orient: "vertical" };
  if (position === "right") return { right: 8, top: 28, bottom: 12, orient: "vertical" };
  return { bottom: 0, left: align === "left" ? 10 : align === "right" ? undefined : "center", right: align === "right" ? 10 : undefined };
}

function formatTooltip(params: unknown, config: ChartConfig, totalByName?: Map<string, number>) {
  const items = Array.isArray(params) ? params.map(asTooltipParam).filter(Boolean) : [asTooltipParam(params)].filter(Boolean);
  const title = String(items[0]?.axisValueLabel ?? items[0]?.name ?? "");

  return tooltipMarkup(title, items.map((item) => {
    const value = Array.isArray(item?.value) ? item.value.at(-1) : item?.value;
    const total = totalByName?.get(String(item?.seriesName ?? ""));
    const numeric = Number(value ?? 0);
    const suffix = total && total > 0 ? ` (${((numeric / total) * 100).toFixed(1).replace(".0", "")}%)` : "";
    return {
      marker: item?.marker,
      name: String(item?.seriesName ?? item?.name ?? "Valor"),
      value: `${formatChartValue(numeric, config.valueFormat)}${suffix}`,
    };
  }));
}

function tooltipMarkup(title: string, items: { marker?: string; name: string; value: string }[]) {
  const rows = items.map((item) => (
    `<div style="display:flex;align-items:center;gap:8px;justify-content:space-between;min-width:160px;margin-top:4px;">
      <span style="display:flex;align-items:center;gap:6px;color:rgba(255,255,255,.72);">${item.marker ?? ""}${escapeHtml(item.name)}</span>
      <strong style="font-weight:600;color:#fff;">${escapeHtml(item.value)}</strong>
    </div>`
  )).join("");

  return `<div><div style="font-weight:600;margin-bottom:4px;">${escapeHtml(title)}</div>${rows}</div>`;
}

function asTooltipParam(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  return value as {
    axisValueLabel?: string;
    marker?: string;
    name?: string;
    seriesName?: string;
    value?: unknown;
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
