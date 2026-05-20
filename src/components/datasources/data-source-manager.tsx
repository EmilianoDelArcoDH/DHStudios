"use client";

import { useMemo, useState } from "react";
import { Calculator, Check, Database, Eye, EyeOff, Plus, Save, Trash2 } from "lucide-react";
import type { AggregationType, CalculatedField, ColumnFormat, ColumnType, Dataset, DatasetColumnConfig } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "@/store/editor-store";
import { ensureDatasetConfig, getDatasetColumnConfig, validateCalculatedFieldFormula } from "@/lib/dataset";
import { cn } from "@/lib/utils";

const formats: ColumnFormat[] = ["text", "number", "currency", "percent", "date"];
const aggregations: AggregationType[] = ["none", "sum", "avg", "min", "max", "count", "countDistinct"];
const types: ColumnType[] = ["text", "number", "date", "boolean"];
const optionLabels: Record<string, string> = {
  text: "Texto",
  number: "Número",
  currency: "Moneda",
  percent: "Porcentaje",
  date: "Fecha",
  boolean: "Booleano",
  none: "Ninguna",
  sum: "Suma",
  avg: "Promedio",
  min: "Mínimo",
  max: "Máximo",
  count: "Conteo",
  countDistinct: "Conteo único",
};

export function DataSourceManager({ initialDatasetId, onClose }: { initialDatasetId?: string; onClose?: () => void }) {
  const { report, updateDataset } = useEditorStore();
  const [selectedDatasetId, setSelectedDatasetId] = useState(initialDatasetId ?? report.datasets[0]?.id);
  const selectedDataset = report.datasets.find((dataset) => dataset.id === selectedDatasetId) ?? report.datasets[0];
  const [draft, setDraft] = useState<Dataset | undefined>(() => selectedDataset ? ensureDatasetConfig(selectedDataset) : undefined);
  const [status, setStatus] = useState("");

  const columnConfigs = useMemo(() => (draft ? getDatasetColumnConfig(draft) : []), [draft]);
  const baseColumns = useMemo(() => columnConfigs.filter((column) => !column.isCalculated), [columnConfigs]);
  const calculatedColumns = useMemo(() => columnConfigs.filter((column) => column.isCalculated), [columnConfigs]);
  const formulaErrors = useMemo(() => {
    if (!draft) return new Map<string, string>();
    return new Map(
      (draft.calculatedFields ?? []).map((field) => {
        const validation = validateCalculatedFieldFormula(draft, field.formula);
        const referencesItself = validation.valid && field.name && field.formula.match(new RegExp(`\\b${escapeRegExp(field.name)}\\b`));
        return [field.id, referencesItself ? "El campo no puede referenciarse a sí mismo." : validation.message];
      }),
    );
  }, [draft]);
  const hasFormulaErrors = Array.from(formulaErrors.values()).some(Boolean);

  const updateColumnConfig = (name: string, patch: Partial<DatasetColumnConfig>) => {
    setDraft((current) => {
      if (!current) return current;
      const configs = getDatasetColumnConfig(current).map((config) => (config.name === name ? { ...config, ...patch } : config));
      return { ...current, columnConfig: configs };
    });
  };

  const updateCalculatedField = (id: string, patch: Partial<CalculatedField>) => {
    setDraft((current) => {
      if (!current) return current;
      const previousFields = current.calculatedFields ?? [];
      const previousField = previousFields.find((field) => field.id === id);
      const nextFields = previousFields.map((field) => (field.id === id ? { ...field, ...patch } : field));
      const renamedFrom = previousField?.name;
      const renamedTo = patch.name;
      const nextConfig = (current.columnConfig ?? []).map((config) => {
        if (renamedFrom && renamedTo && config.name === renamedFrom) return { ...config, name: renamedTo, label: patch.label ?? config.label };
        if (previousField && config.name === previousField.name) return { ...config, ...fieldConfigPatch(patch), formula: patch.formula ?? config.formula };
        return config;
      });
      return { ...current, calculatedFields: nextFields, columnConfig: nextConfig };
    });
  };

  const addCalculatedField = () => {
    setDraft((current) => {
      if (!current) return current;
      const index = (current.calculatedFields?.length ?? 0) + 1;
      const field: CalculatedField = {
        id: crypto.randomUUID(),
        name: `campo_calculado_${index}`,
        label: `Campo calculado ${index}`,
        formula: "",
        type: "number",
        format: "number",
        defaultAggregation: "sum",
      };
      return { ...current, calculatedFields: [...(current.calculatedFields ?? []), field] };
    });
  };

  const removeCalculatedField = (id: string) => {
    setDraft((current) => {
      if (!current) return current;
      const removedField = current.calculatedFields?.find((field) => field.id === id);
      return {
        ...current,
        calculatedFields: (current.calculatedFields ?? []).filter((field) => field.id !== id),
        columnConfig: (current.columnConfig ?? []).filter((config) => config.name !== removedField?.name),
      };
    });
  };

  const appendToFormula = (id: string, text: string) => {
    updateCalculatedField(id, { formula: `${draft?.calculatedFields?.find((field) => field.id === id)?.formula ?? ""} ${text}`.trimStart() });
  };

  const save = () => {
    if (!draft || hasFormulaErrors) return;
    updateDataset(draft.id, ensureDatasetConfig(draft));
    setStatus("Cambios guardados");
    window.setTimeout(() => setStatus(""), 1800);
  };

  if (!report.datasets.length) {
    return (
      <section className="flex h-full items-center justify-center bg-[var(--dh-gray-ui)] p-6">
        <div className="max-w-sm rounded-md border border-[var(--dh-border)] bg-card p-5 text-center shadow-sm">
          <Database className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <h2 className="text-sm font-semibold">No hay fuentes cargadas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Subí un CSV o agregá datos demo desde el panel izquierdo.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 bg-[var(--dh-gray-ui)]">
      <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--dh-border)] bg-card">
        <div className="border-b border-[var(--dh-border)] p-3">
          <h2 className="text-sm font-semibold">Fuentes de datos</h2>
          <p className="text-xs text-muted-foreground">Campos, formatos y cálculos locales.</p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
          {report.datasets.map((dataset) => (
            <button
              key={dataset.id}
              type="button"
              className={cn(
                "w-full rounded-md border border-[var(--dh-border)] bg-background p-3 text-left transition-colors hover:bg-muted/60",
                dataset.id === draft?.id && "border-primary bg-primary/5",
              )}
              onClick={() => {
                setSelectedDatasetId(dataset.id);
                setDraft(ensureDatasetConfig(dataset));
                setStatus("");
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{dataset.name}</span>
                {dataset.id === draft?.id ? <Check className="h-4 w-4 text-primary" /> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="secondary">{sourceLabel(dataset.sourceType)}</Badge>
                <Badge variant="outline">{dataset.rows.length} filas</Badge>
                <Badge variant="outline">{dataset.columns.length} columnas</Badge>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">{formatDatasetDate(dataset.createdAt)}</div>
            </button>
          ))}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto p-4">
        {draft ? (
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="rounded-md border border-[var(--dh-border)] bg-background px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-base font-semibold">{draft.name}</h1>
                  <p className="text-xs text-muted-foreground">
                    {draft.rows.length} filas - {baseColumns.length} columnas originales - {calculatedColumns.length} calculadas
                  </p>
                </div>
                {status ? <span className="text-xs text-emerald-700">{status}</span> : null}
                <Button variant="outline" size="sm" onClick={onClose}>Volver al lienzo</Button>
                <Button size="sm" onClick={save} disabled={hasFormulaErrors}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar cambios
                </Button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <Stat label="Origen" value={sourceLabel(draft.sourceType)} />
                <Stat label="Campos visibles" value={String(columnConfigs.filter((column) => column.visible).length)} />
                <Stat label="Formatos" value={String(new Set(columnConfigs.map((column) => column.format)).size)} />
                <Stat label="Fecha de carga" value={shortDatasetDate(draft.createdAt)} />
              </div>
            </div>

            <section className="space-y-3 rounded-md border border-[var(--dh-border)] bg-background p-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">Columnas</h2>
                <p className="text-xs text-muted-foreground">El formato solo cambia la visualización; el dato original queda intacto.</p>
              </div>
              <div className="overflow-auto rounded-md border border-[var(--dh-border)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Formato visual</TableHead>
                      <TableHead>Agregación por defecto</TableHead>
                      <TableHead>Visible</TableHead>
                      <TableHead>Etiqueta visible</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columnConfigs.map((column) => (
                      <TableRow key={column.name}>
                        <TableCell className="min-w-44">
                          <div className="text-sm font-medium">{column.label || column.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{column.name}</div>
                          {column.isCalculated ? <Badge variant="secondary" className="mt-1">Calculado</Badge> : null}
                        </TableCell>
                        <TableCell className="text-xs">{optionLabel(column.type)}</TableCell>
                        <TableCell>
                          <CompactSelect value={column.format} values={formats} onChange={(format) => updateColumnConfig(column.name, { format })} />
                        </TableCell>
                        <TableCell>
                          <CompactSelect
                            value={column.defaultAggregation}
                            values={aggregations}
                            onChange={(defaultAggregation) => updateColumnConfig(column.name, { defaultAggregation })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {column.visible ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                            <Switch checked={column.visible} onCheckedChange={(visible) => updateColumnConfig(column.name, { visible })} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input value={column.label} onChange={(event) => updateColumnConfig(column.name, { label: event.target.value })} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-3 rounded-md border border-[var(--dh-border)] bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold"><Calculator className="h-4 w-4" />Campos calculados</h2>
                  <p className="text-xs text-muted-foreground">Armá fórmulas con columnas existentes y operadores numéricos simples.</p>
                </div>
                <Button variant="outline" size="sm" onClick={addCalculatedField}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar campo calculado
                </Button>
              </div>
              {(draft.calculatedFields ?? []).length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--dh-border)] p-4 text-sm text-muted-foreground">
                  Todavía no hay campos calculados.
                </div>
              ) : null}
              <div className="space-y-3">
                {(draft.calculatedFields ?? []).map((field) => {
                  const error = formulaErrors.get(field.id);
                  const formulaColumns = columnConfigs.filter((column) => column.type === "number" && column.name !== field.name);
                  return (
                    <div key={field.id} className="space-y-3 rounded-md border border-[var(--dh-border)] bg-muted/20 p-3">
                      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_120px_150px_170px_auto]">
                        <Field label="Nombre técnico">
                          <Input value={field.name} onChange={(event) => updateCalculatedField(field.id, { name: sanitizeColumnName(event.target.value) })} />
                        </Field>
                        <Field label="Etiqueta">
                          <Input value={field.label} onChange={(event) => updateCalculatedField(field.id, { label: event.target.value })} />
                        </Field>
                        <Field label="Tipo">
                          <CompactSelect value={field.type} values={types} onChange={(type) => updateCalculatedField(field.id, { type })} />
                        </Field>
                        <Field label="Formato">
                          <CompactSelect value={field.format} values={formats} onChange={(format) => updateCalculatedField(field.id, { format })} />
                        </Field>
                        <Field label="Agregación">
                          <CompactSelect
                            value={field.defaultAggregation}
                            values={aggregations}
                            onChange={(defaultAggregation) => updateCalculatedField(field.id, { defaultAggregation })}
                          />
                        </Field>
                        <div className="flex items-end">
                          <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => removeCalculatedField(field.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
                        <div className="space-y-2">
                          <Label>Columnas disponibles</Label>
                          <div className="max-h-44 overflow-auto rounded-md border border-[var(--dh-border)] bg-background p-2">
                            <div className="flex flex-wrap gap-1.5">
                              {formulaColumns.map((column) => (
                                <button
                                  key={`${field.id}-${column.name}`}
                                  type="button"
                                  className="rounded-md border border-[var(--dh-border)] bg-card px-2 py-1 text-left text-xs hover:border-primary hover:text-primary"
                                  onClick={() => appendToFormula(field.id, column.name)}
                                >
                                  <span className="block font-medium">{column.label}</span>
                                  <span className="block font-mono text-[10px] text-muted-foreground">{column.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {["+", "-", "*", "/"].map((operator) => (
                              <Button key={operator} type="button" variant="outline" size="sm" onClick={() => appendToFormula(field.id, operator)}>
                                {operator}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Field label="Fórmula">
                            <Textarea
                              value={field.formula}
                              onChange={(event) => updateCalculatedField(field.id, { formula: event.target.value })}
                              placeholder="precio * cantidad"
                              className="min-h-28 font-mono text-sm"
                            />
                          </Field>
                          <div className="flex flex-wrap gap-1.5">
                            {["precio * cantidad", "ventas - costo", "ventas / cantidad"].map((example) => (
                              <Button key={example} type="button" variant="ghost" size="sm" onClick={() => updateCalculatedField(field.id, { formula: example })}>
                                {example}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                      {error ? <p className="text-xs text-destructive">{error}</p> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </section>
  );
}

function CompactSelect<T extends string>({ value, values, onChange }: { value: T; values: T[]; onChange: (value: T) => void }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger className="w-full min-w-32"><SelectValue /></SelectTrigger>
      <SelectContent>{values.map((item) => <SelectItem key={item} value={item}>{optionLabel(item)}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function optionLabel(value: string) {
  return optionLabels[value] ?? value;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--dh-border)] bg-muted/30 px-3 py-2">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function fieldConfigPatch(patch: Partial<CalculatedField>): Partial<DatasetColumnConfig> {
  return {
    label: patch.label,
    type: patch.type,
    format: patch.format,
    defaultAggregation: patch.defaultAggregation,
  };
}

function sanitizeColumnName(value: string) {
  return value.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "");
}

function sourceLabel(value?: Dataset["sourceType"]) {
  if (value === "csv") return "CSV";
  if (value === "xlsx") return "XLSX";
  if (value === "google_sheets") return "Google Sheets";
  if (value === "manual") return "Manual";
  return "Desconocida";
}

function formatDatasetDate(value?: string) {
  if (!value) return "Sin fecha de carga";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha de carga";
  return `Cargado ${date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}`;
}

function shortDatasetDate(value?: string) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-AR", { dateStyle: "short" });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
