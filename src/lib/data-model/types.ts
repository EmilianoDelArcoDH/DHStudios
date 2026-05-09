import type { Aggregation, Dataset, DatasetColumn, ID } from "@/types";

export type { Dataset, DatasetColumn };

export type DatasetRelationship = {
  id: ID;
  fromDatasetId: ID;
  fromColumn: string;
  toDatasetId: ID;
  toColumn: string;
  cardinality: "many-to-one";
};

export type DataModel = {
  relationships: DatasetRelationship[];
};

export type QueryField = {
  datasetId: ID;
  column: string;
};

export type WidgetQuery = {
  baseDatasetId: ID;
  dimensions: QueryField[];
  metrics: QueryField[];
  aggregation: Aggregation;
  limit?: number;
  orderDirection?: "asc" | "desc";
};

export type JoinedRow = Record<string, string | number | boolean | null>;

export function fieldKey(field: QueryField) {
  return `${field.datasetId}.${field.column}`;
}
