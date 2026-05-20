"use client";

import { useMemo } from "react";
import type { DatasetRow, ReportWidget } from "@/types";
import { getAxisStyle, getGridOption, getLegendOption, getPieTooltipOption, getTooltipOption, type ChartOption } from "./chart-options/baseOptions";
import { getChartPalette } from "./chart-options/theme";
import { barChartOptions, baseChartOptions, lineChartOptions, pieChartOptions } from "./chart-options";

export type ChartData = {
  dimensions: string[];
  metrics: string[];
  categories: string[];
  series: { name: string; data: number[] }[];
  rows: DatasetRow[];
};

type UseChartOptionsArgs = {
  widget: ReportWidget;
  chartData: ChartData;
};

export function useChartOptions({ widget, chartData }: UseChartOptionsArgs) {
  return useMemo<ChartOption>(() => buildChartOption(widget, chartData), [chartData, widget]);
}

function buildChartOption(widget: ReportWidget, chartData: ChartData): ChartOption {
  const config = widget.config;
  const style = widget.style;
  const colors = getChartPalette(config, style);
  const firstMetric = chartData.series[0];
  const showLegend = config.showLegend ?? style.showLegend ?? true;
  const labelShow = config.labelShow ?? style.showDataLabels ?? false;
  const legendListMode = (config.legendLayout ?? "auto") === "list" || (widget.type === "pie" || widget.type === "donut") && chartData.categories.length > 8;

  if (widget.type === "pie" || widget.type === "donut") {
    const pieData = chartData.categories.map((name, index) => ({ name, value: firstMetric?.data[index] ?? 0 }));
    const total = pieData.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
    const requestedPieOuterRadius = style.pieOuterRadius ?? 62;
    const pieOuterRadius = showLegend && legendListMode ? Math.min(Math.max(requestedPieOuterRadius, 82), 88) : showLegend ? Math.min(Math.max(requestedPieOuterRadius, 72), 82) : requestedPieOuterRadius;
    const pieRadius = widget.type === "donut"
      ? [`${style.pieInnerRadius ?? 45}%`, `${pieOuterRadius}%`]
      : [`${style.pieInnerRadius ?? 0}%`, `${pieOuterRadius}%`];
    const pieCenter = showLegend && legendListMode ? ["30%", "52%"] : ["50%", showLegend ? "42%" : "50%"];
    const pieBottom = showLegend && !legendListMode ? 58 : 0;
    const piePercentEnabled = style.showPiePercent ?? true;
    const pieLabelShow = labelShow || piePercentEnabled;

    return {
      ...baseChartOptions,
      ...pieChartOptions,
      color: colors,
      tooltip: getPieTooltipOption(config, total),
      legend: legendListMode
        ? { ...getLegendOption({ ...config, legendLayout: "list" }, style), right: 4, top: 28, bottom: 12, width: "28%" }
        : getLegendOption(config, style),
      series: [{
        type: "pie",
        radius: pieRadius,
        center: pieCenter,
        top: 0,
        bottom: pieBottom,
        avoidLabelOverlap: true,
        label: {
          show: pieLabelShow,
          position: piePercentEnabled ? "inside" : "outside",
          formatter: piePercentEnabled ? "{d}%" : "{b}",
          fontSize: style.fontSize ?? 11,
          color: piePercentEnabled ? "#ffffff" : undefined,
          fontWeight: style.fontWeight ?? "normal",
          fontStyle: style.fontStyle ?? "normal",
        },
        labelLine: { show: !piePercentEnabled && pieLabelShow, length: 8, length2: 8 },
        minShowLabelAngle: piePercentEnabled ? 3 : 0,
        data: pieData,
        emphasis: {
          scale: true,
          scaleSize: 6,
          itemStyle: { shadowBlur: 18, shadowColor: "rgba(15, 23, 42, 0.18)" },
        },
      }],
    };
  }

  if (widget.type === "scatter") {
    const [xMetric, yMetric] = chartData.metrics;
    const rows = chartData.rows.slice(0, config.limit ?? 50);
    const axisStyle = getAxisStyle(config, style);
    return {
      ...baseChartOptions,
      color: colors,
      tooltip: getTooltipOption(config),
      legend: getLegendOption(config, style),
      grid: getGridOption(config, style, widget.type),
      xAxis: { type: "value", name: xMetric, ...axisStyle },
      yAxis: { type: "value", name: yMetric, ...axisStyle },
      series: [{
        name: `${xMetric ?? "x"} / ${yMetric ?? "y"}`,
        type: "scatter",
        symbolSize: 9,
        data: rows.map((row) => [Number(row[xMetric] ?? 0), Number(row[yMetric] ?? 0)]),
        emphasis: { focus: "series" },
      }],
    };
  }

  const orientation = config.orientation ?? (widget.type === "horizontal_bar" ? "horizontal" : "vertical");
  const isHorizontal = orientation === "horizontal";
  const isStacked = widget.type === "stacked_bar" || config.stack || style.stackSeries;
  const isLineLike = widget.type === "line" || widget.type === "multi_line" || widget.type === "area";
  const axisStyle = getAxisStyle(config, style);
  const totalByName = new Map(chartData.series.map((item) => [item.name, item.data.reduce((sum, value) => sum + Number(value ?? 0), 0)]));

  const series = chartData.series.map((item, index) => {
    const comboLine = widget.type === "combo" && index > 0;
    const type = comboLine || isLineLike ? "line" : "bar";
    return {
      name: item.name,
      type,
      barWidth: type === "bar" ? "45%" : undefined,
      stack: isStacked ? "total" : undefined,
      smooth: type === "line" ? config.smooth ?? true : undefined,
      yAxisIndex: widget.type === "combo" && comboLine ? 1 : 0,
      areaStyle: widget.type === "area" ? { opacity: 0.18 } : undefined,
      lineStyle: type === "line" ? { width: style.lineWidth ?? lineChartOptions.lineStyle.width } : undefined,
      symbol: type === "line" ? "circle" : undefined,
      symbolSize: type === "line" ? lineChartOptions.symbolSize : undefined,
      itemStyle: {
        color: colors[index % colors.length],
        borderRadius: type === "bar" ? style.barRadius ?? 4 : undefined,
      },
      emphasis: { focus: "series" },
      label: {
        show: labelShow,
        position: isHorizontal ? "right" : "top",
        fontSize: style.fontSize ?? 11,
        fontWeight: style.fontWeight ?? "normal",
        fontStyle: style.fontStyle ?? "normal",
      },
      data: item.data,
      barMaxWidth: type === "bar" ? 42 : undefined,
    };
  });

  return {
    ...baseChartOptions,
    ...(isLineLike || widget.type === "combo" ? lineChartOptions : barChartOptions),
    color: colors,
    animationDuration: 800,
    animationDurationUpdate: 420,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut",
    tooltip: getTooltipOption(config, totalByName),
    legend: getLegendOption(config, style),
    grid: getGridOption(config, style, widget.type),
    xAxis: isHorizontal
      ? { type: "value", ...axisStyle }
      : { type: "category", data: chartData.categories, ...axisStyle },
    yAxis: widget.type === "combo"
      ? [{ type: "value", ...axisStyle }, { type: "value", ...axisStyle }]
      : isHorizontal
        ? { type: "category", data: chartData.categories, ...axisStyle }
        : { type: "value", ...axisStyle },
    series,
  };
}
