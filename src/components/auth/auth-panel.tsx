"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { reportService } from "@/services/report-service";

export function AuthPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (mode: "in" | "up") => {
    setLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const result = mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      setMessage(mode === "up" ? "Cuenta creada. Revisá el email si Supabase requiere confirmación." : "Sesión iniciada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo autenticar.");
    } finally {
      setLoading(false);
    }
  };

  if (!reportService.isEnabled()) {
    return (
      <Alert className="rounded-md">
        <AlertDescription>Supabase no está configurado. La app funciona en modo demo local hasta cargar las variables de entorno.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="rounded-md">
      <CardHeader><CardTitle className="text-base">Autenticación</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-[1fr_1fr_auto_auto] items-end gap-2">
        <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="space-y-1"><Label>Contraseña</Label><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <Button disabled={loading || !email || !password} onClick={() => void submit("in")}><LogIn className="mr-2 h-4 w-4" />Entrar</Button>
        <Button variant="outline" disabled={loading || !email || !password} onClick={() => void submit("up")}>Crear</Button>
        {message ? <p className="col-span-4 text-xs text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
