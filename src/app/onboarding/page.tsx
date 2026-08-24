"use client";

import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Rocket className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bienvenido a Daytuba Tasks
          </h1>
          <p className="text-sm text-muted-foreground">
            Tu plataforma de gestión de tareas para estudiantes UTP.
          </p>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>¡Empecemos!</CardTitle>
            <CardDescription>
              Accede a tu dashboard para crear tus primeras tareas, proyectos y categorías.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => router.push("/dashboard")}>
              Ir al Dashboard
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Crea categorías como &ldquo;FISC&rdquo;, &ldquo;Personal&rdquo; o &ldquo;Organización LIGA&rdquo; para etiquetar tus tareas.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
