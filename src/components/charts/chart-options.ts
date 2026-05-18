export const baseChartOptions = {
  backgroundColor: "transparent",
  tooltip: {
    trigger: "axis",
    backgroundColor: "rgba(0,0,0,0.85)",
    borderWidth: 0,
    textStyle: { color: "#fff" },
    padding: [8, 12],
  },
  grid: {
    left: "8%",
    right: "5%",
    top: "12%",
    bottom: "8%",
    containLabel: true,
  },
  textStyle: {
    fontFamily: "Inter, system-ui, sans-serif",
  },
  animationDuration: 800,
  animationEasing: "cubicOut",
} as const;

export const barChartOptions = {
  ...baseChartOptions,
  grid: { left: "10%", right: "5%", top: "15%", bottom: "12%", containLabel: true },
  legend: {
    show: true,
    bottom: 0,
    icon: "roundRect",
    itemGap: 20,
    textStyle: { fontSize: 12 },
  },
  xAxis: {
    axisLabel: { fontSize: 11, padding: [5, 0, 0, 0] },
  },
  yAxis: {
    axisLabel: { fontSize: 11 },
  },
} as const;

export const lineChartOptions = {
  ...baseChartOptions,
  grid: { left: "10%", right: "8%", top: "12%", bottom: "10%", containLabel: true },
  legend: { bottom: 0 },
  lineStyle: { width: 3 },
  symbol: "circle",
  symbolSize: 5,
} as const;

export const pieChartOptions = {
  ...baseChartOptions,
  legend: {
    bottom: 0,
    orient: "horizontal",
  },
} as const;
