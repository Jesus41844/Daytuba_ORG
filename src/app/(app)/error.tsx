"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Algo salió mal</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error.message || "Ocurrió un error inesperado. Intenta de nuevo."}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={reset}>
        Intentar de nuevo
      </Button>
    </div>
  );
}
