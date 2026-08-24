import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Página no encontrada</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          La página que buscas no existe o fue movida.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<Link href="/dashboard" />}
      >
        Volver al dashboard
      </Button>
    </div>
  );
}
