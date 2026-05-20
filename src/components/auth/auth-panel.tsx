"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";

export function AuthPanel() {
  return (
    <Alert className="rounded-md">
      <AlertDescription>
        Esta instalacion usa Neon/Vercel Postgres con una clave local de edicion por navegador.
        Los links publicos permiten ver e interactuar, pero no editar.
      </AlertDescription>
    </Alert>
  );
}
