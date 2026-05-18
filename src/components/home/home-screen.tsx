"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownAZ, CalendarClock, Copy, FileText, Globe2, LayoutDashboard, Loader2, Plus, Search, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportService, type ProjectSummary, type ProjectTemplate } from "@/services/report-service";
import { cn } from "@/lib/utils";

type SortMode = "updated" | "name";
type TemplateOption = { value: ProjectTemplate; label: string; description: string };
type ThumbnailData = {
  theme?: { pageBackground?: string; primary?: string; accent?: string };
  widgets?: { id: string; type: string; x: number; y: number; w: number; h: number; color?: string }[];
};

const templateOptions: TemplateOption[] = [
  { value: "En blanco", label: "En blanco", description: "Canvas limpio para empezar desde cero." },
  { value: "Comercial", label: "Comercial", description: "Tablero demo con KPIs, barras, línea y tabla." },
];

export function HomeScreen() {
  const router = useRouter();
  const [projects] = useState<ProjectSummary[]>(() => reportService.getRecentProjects());
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("Nuevo tablero");
  const [template, setTemplate] = useState<ProjectTemplate>("En blanco");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [loading, setLoading] = useState<"create" | "open" | "duplicate" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", window.localStorage.getItem("dhstudios.appearance") === "dark");
  }, []);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? projects.filter((project) => `${project.name} ${project.projectId}`.toLowerCase().includes(normalizedQuery))
      : projects;

    return [...filtered].sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [projects, query, sortMode]);

  const createProject = async () => {
    setLoading("create");
    setError("");
    try {
      const report = await reportService.createProject(projectName.trim() || "Nuevo tablero", template);
      router.push(`/editor/${report.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el proyecto.");
      setLoading(null);
    }
  };

  const openProject = async (id = projectId.trim()) => {
    const normalized = id.trim();
    if (!normalized) {
      setError("Ingresá un ID de proyecto para abrirlo.");
      return;
    }
    setLoading("open");
    setError("");
    try {
      const report = await reportService.getReportByProjectId(normalized);
      if (!report) {
        setError("No se encontró un proyecto con ese ID.");
        setLoading(null);
        return;
      }
      router.push(`/editor/${report.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar el proyecto.");
      setLoading(null);
    }
  };

  const duplicateProject = async (project: ProjectSummary) => {
    setLoading("duplicate");
    setError("");
    try {
      const report = await reportService.duplicateProject(project.projectId);
      if (!report) {
        setError("No se pudo duplicar el proyecto.");
        setLoading(null);
        return;
      }
      router.push(`/editor/${report.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo duplicar el proyecto.");
      setLoading(null);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8">
        <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <span className="font-heading text-xl font-semibold">DH Studio</span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-normal">Espacio de trabajo</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Tus tableros recientes, prototipos y reportes compartidos en un solo lugar.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border border-border bg-card p-3 shadow-sm sm:grid-cols-[220px_180px_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="project-name">Nombre</Label>
              <Input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Plantilla</Label>
              <Select value={template} onValueChange={(value) => setTemplate(value as ProjectTemplate)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templateOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="self-end" onClick={() => void createProject()} disabled={loading !== null}>
              {loading === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Nuevo proyecto
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-6 py-6 lg:grid-cols-[1fr_320px]">
          <section className="min-w-0 space-y-4">
            <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 shadow-sm md:flex-row md:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar por nombre o ID de proyecto" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger className="w-full md:w-48">
                  {sortMode === "updated" ? <CalendarClock className="mr-2 h-4 w-4" /> : <ArrowDownAZ className="mr-2 h-4 w-4" />}
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Última modificación</SelectItem>
                  <SelectItem value="name">Nombre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredProjects.length ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.projectId}
                    project={project}
                    busy={loading !== null}
                    onOpen={() => void openProject(project.projectId)}
                    onDuplicate={() => void duplicateProject(project)}
                  />
                ))}
              </div>
            ) : (
              <EmptyWorkspace hasProjects={projects.length > 0} />
            )}
          </section>

          <aside className="space-y-4">
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">Abrir por ID</h2>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectId">ID de proyecto</Label>
                  <Input
                    id="projectId"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="font-mono text-xs"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void openProject();
                    }}
                  />
                </div>
                <Button variant="outline" className="w-full" onClick={() => void openProject()} disabled={loading !== null}>
                  {loading === "open" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Abrir proyecto
                </Button>
                {error ? <Alert variant="destructive" className="rounded-md"><AlertDescription>{error}</AlertDescription></Alert> : null}
              </CardContent>
            </Card>

            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Plantillas disponibles</p>
              <div className="mt-3 space-y-3">
                {templateOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={cn("w-full rounded-md border p-3 text-left transition-colors hover:bg-card", template === item.value ? "border-primary bg-card" : "border-border")}
                    onClick={() => setTemplate(item.value)}
                  >
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function ProjectCard({ project, busy, onOpen, onDuplicate }: { project: ProjectSummary; busy: boolean; onOpen: () => void; onDuplicate: () => void }) {
  return (
    <Card className="group overflow-hidden border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <button type="button" className="block w-full text-left" onClick={onOpen} disabled={busy}>
        <ProjectThumbnail thumbnail={project.thumbnail} />
        <CardContent className="space-y-3 p-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">{project.name}</h2>
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{project.projectId}</p>
            </div>
            {project.isPublic ? (
              <Badge variant="secondary" className="shrink-0">
                <Globe2 className="mr-1 h-3 w-3" />
                Público
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{project.pageCount} {project.pageCount === 1 ? "página" : "páginas"}</span>
            <span>{formatDate(project.updatedAt)}</span>
          </div>
        </CardContent>
      </button>
      <div className="border-t border-border px-4 py-2">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onDuplicate} disabled={busy}>
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Duplicar
        </Button>
      </div>
    </Card>
  );
}

function ProjectThumbnail({ thumbnail }: { thumbnail?: string }) {
  const parsed = parseThumbnail(thumbnail);
  const widgets = parsed?.widgets ?? [];
  const theme = parsed?.theme;

  return (
    <div className="relative h-40 border-b border-border bg-muted p-4">
      <div className="h-full rounded border border-border bg-card p-2" style={{ backgroundColor: theme?.pageBackground }}>
        {widgets.length ? (
          <div className="relative h-full">
            {widgets.map((widget) => (
              <span
                key={widget.id}
                className="absolute rounded-sm border border-border/70 bg-background shadow-sm"
                style={{
                  left: `${Math.min(92, widget.x * 7.5)}%`,
                  top: `${Math.min(82, widget.y * 8)}%`,
                  width: `${Math.max(10, widget.w * 7)}%`,
                  height: `${Math.max(12, widget.h * 8)}%`,
                  background: widget.type === "scorecard" || widget.type === "kpi" ? theme?.primary : "var(--card)",
                  borderColor: widget.color ?? theme?.accent,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">
            Sin widgets
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyWorkspace({ hasProjects }: { hasProjects: boolean }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-card px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <LayoutDashboard className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{hasProjects ? "No hay resultados" : "Tu espacio de trabajo está listo"}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasProjects ? "Probá con otro nombre o volvé a ordenar por fecha." : "Creá tu primer tablero desde una plantilla o un lienzo en blanco."}
      </p>
    </div>
  );
}

function parseThumbnail(value?: string): ThumbnailData | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as ThumbnailData;
  } catch {
    return undefined;
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}
