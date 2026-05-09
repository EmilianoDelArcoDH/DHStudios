import type { Dataset } from "@/types";
import type { DataModel, JoinedRow } from "./types";

export function joinDatasets(baseDataset: Dataset, datasets: Dataset[], dataModel?: DataModel): JoinedRow[] {
  const datasetById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  const joinPlans = (dataModel?.relationships ?? [])
    .flatMap((relationship) => {
      if (relationship.fromDatasetId === baseDataset.id) {
        return [{
          id: `${relationship.id}:forward`,
          sourceColumn: relationship.fromColumn,
          targetDatasetId: relationship.toDatasetId,
          targetColumn: relationship.toColumn,
        }];
      }

      if (relationship.toDatasetId === baseDataset.id) {
        return [{
          id: `${relationship.id}:reverse`,
          sourceColumn: relationship.toColumn,
          targetDatasetId: relationship.fromDatasetId,
          targetColumn: relationship.fromColumn,
        }];
      }

      return [];
    })
    .filter((plan) => plan.sourceColumn && plan.targetColumn && plan.targetDatasetId !== baseDataset.id);

  if (!joinPlans.length) {
    return baseDataset.rows.map((row) => qualifyBaseRow(baseDataset.id, row));
  }

  const lookupByRelationship = new Map<string, Map<string, JoinedRow>>();

  joinPlans.forEach((plan) => {
    const targetDataset = datasetById.get(plan.targetDatasetId);
    if (!targetDataset) return;

    const lookup = new Map<string, JoinedRow>();
    targetDataset.rows.forEach((row) => {
      const key = normalizeJoinKey(row[plan.targetColumn]);
      if (!lookup.has(key)) lookup.set(key, qualifyBaseRow(targetDataset.id, row));
    });
    lookupByRelationship.set(plan.id, lookup);
  });

  return baseDataset.rows.map((row) => {
    const joinedRow = qualifyBaseRow(baseDataset.id, row);

    joinPlans.forEach((plan) => {
      const lookup = lookupByRelationship.get(plan.id);
      const targetRow = lookup?.get(normalizeJoinKey(row[plan.sourceColumn]));
      if (targetRow) Object.assign(joinedRow, targetRow);
    });

    return joinedRow;
  });
}

function qualifyBaseRow(datasetId: string, row: Dataset["rows"][number]): JoinedRow {
  const qualified: JoinedRow = { ...row };
  Object.entries(row).forEach(([column, value]) => {
    qualified[`${datasetId}.${column}`] = value;
  });
  return qualified;
}

function normalizeJoinKey(value: unknown) {
  const text = String(value ?? "").trim();
  if (text && !Number.isNaN(Number(text))) return String(Number(text));
  return text;
}
