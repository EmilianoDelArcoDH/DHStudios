"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-3">
      <h1 className="text-lg font-semibold">No se pudo cargar el editor</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
