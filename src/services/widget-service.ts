"use client";

import type { ReportWidget } from "@/types";
import { reportService } from "@/services/report-service";

export const widgetService = {
  save: (widget: ReportWidget) => reportService.saveWidget(widget),
};
