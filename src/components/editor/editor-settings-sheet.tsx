"use client";

import type { ComponentProps } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Settings2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useEditorStore } from "@/store/editor-store";
import { reportThemeSchema } from "@/types";

type EditorSettingsSheetProps = {
  darkMode: boolean;
  onDarkModeChange: (checked: boolean) => void;
};

type ReportThemeForm = z.infer<typeof reportThemeSchema>;

export function EditorSettingsSheet({ darkMode, onDarkModeChange }: EditorSettingsSheetProps) {
  const reportTheme = useEditorStore((state) => state.report.theme);
  const updateTheme = useEditorStore((state) => state.updateTheme);
  const form = useForm<ReportThemeForm>({
    resolver: zodResolver(reportThemeSchema),
    values: reportTheme,
    mode: "onChange",
  });

  const updateThemeField = async (field: keyof Pick<ReportThemeForm, "primary" | "accent" | "pageBackground">, value: string) => {
    form.setValue(field, value, { shouldDirty: true, shouldValidate: true });
    const valid = await form.trigger(field);
    if (valid) updateTheme({ [field]: value });
  };

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" title="Configuración" aria-label="Configuración" className="h-8 w-8" />
        }
      >
        <Settings2 className="h-4 w-4" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full border-[var(--dh-border)] bg-background sm:max-w-md">
        <SheetHeader className="border-b border-[var(--dh-border)] px-4 py-4">
          <SheetTitle>Configuración</SheetTitle>
          <SheetDescription>
            Ajusta la apariencia de la interfaz y el tema visual del reporte.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
          <section className="space-y-4 border-b border-[var(--dh-border)] pb-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Interfaz</h3>
              <p className="text-xs text-muted-foreground">El modo oscuro cambia la herramienta, no el contenido del reporte.</p>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--dh-border)] bg-card px-3 py-3">
              <div className="space-y-1">
                <Label htmlFor="editor-dark-mode">Modo oscuro</Label>
                <p className="text-xs text-muted-foreground">Mantiene el azul DH como color de acción y foco.</p>
              </div>
              <Switch id="editor-dark-mode" checked={darkMode} onCheckedChange={onDarkModeChange} />
            </div>
          </section>

          <section className="space-y-4 pt-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Tema del reporte</h3>
              <p className="text-xs text-muted-foreground">Estos colores impactan el lienzo y los widgets del reporte.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <ColorField
                label="Primario"
                value={reportTheme.primary}
                {...form.register("primary")}
                onChange={(event) => void updateThemeField("primary", event.target.value)}
                error={form.formState.errors.primary?.message}
              />
              <ColorField
                label="Acento"
                value={reportTheme.accent}
                {...form.register("accent")}
                onChange={(event) => void updateThemeField("accent", event.target.value)}
                error={form.formState.errors.accent?.message}
              />
              <ColorField
                label="Hoja"
                value={reportTheme.pageBackground}
                {...form.register("pageBackground")}
                onChange={(event) => void updateThemeField("pageBackground", event.target.value)}
                error={form.formState.errors.pageBackground?.message}
              />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ColorField({ label, error, ...inputProps }: ComponentProps<typeof Input> & { label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="color" {...inputProps} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
