"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reportService } from "@/services/report-service";

export function HomeScreen() {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState<"create" | "open" | null>(null);
  const [error, setError] = useState("");

  const createProject = async () => {
    setLoading("create");
    setError("");
    try {
      const report = await reportService.createProject();
      router.push(`/editor/${report.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el proyecto.");
      setLoading(null);
    }
  };

  const openProject = async () => {
    const normalized = projectId.trim();
    if (!normalized) {
      setError("Ingresá un projectId para abrir un proyecto.");
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

  return (
    <main className="min-h-screen bg-[var(--dh-gray-ui)] text-[var(--dh-black)]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12">
        <div className="grid w-full gap-8 md:grid-cols-[1fr_380px]">
          <div className="flex flex-col justify-center">
            <div className="mb-5 h-2 w-24 rounded-sm bg-[var(--dh-blue)]" />
            <h1 className="max-w-xl text-4xl font-semibold tracking-normal text-[var(--dh-black)]">DH Studio</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--dh-gray-900)]">
              Creá y abrí reportes visuales con un projectId único. La estructura se mantiene familiar para estudiantes que ya conocen herramientas BI visuales.
            </p>
          </div>
          <Card className="rounded-md border-[var(--dh-border)] bg-white shadow-sm">
            <CardHeader><CardTitle className="text-lg">Proyectos</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <Button className="w-full" onClick={() => void createProject()} disabled={loading !== null}>
                {loading === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Crear nuevo proyecto
              </Button>
              <div className="space-y-2">
                <Label htmlFor="projectId">Buscar proyecto por ID</Label>
                <Input id="projectId" value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono" onKeyDown={(event) => { if (event.key === "Enter") void openProject(); }} />
              </div>
              <Button variant="outline" className="w-full" onClick={() => void openProject()} disabled={loading !== null}>
                {loading === "open" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                Abrir proyecto
              </Button>
              {error ? <Alert variant="destructive" className="rounded-md"><AlertDescription>{error}</AlertDescription></Alert> : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
