"use client";

import type { Dataset } from "@/types";
import { reportService } from "@/services/report-service";

export const datasetService = {
  save: (projectId: string, dataset: Dataset) => reportService.saveDataset(projectId, dataset),
};
