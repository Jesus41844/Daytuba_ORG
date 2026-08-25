import * as React from "react";
import Link from "next/link";

import { ToasterWrapper } from "@/components/providers/toaster-wrapper";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-notebook-lines px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-start gap-8">
        <header className="flex flex-col items-start gap-2">
          <Link
            href="/"
            className="animate-fade-in-up flex items-center gap-3"
            aria-label="Daytuba — ir al inicio"
            style={{ animationDelay: "0ms" }}
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-sm">
              D
            </span>
            <span className="font-display text-3xl font-bold tracking-tight text-foreground">
              Daytuba
            </span>
          </Link>
          <p
            className="animate-fade-in-up text-sm text-muted-foreground"
            style={{ animationDelay: "80ms" }}
          >
            Organiza tu semana universitaria
          </p>
        </header>

        <main
          className="animate-fade-in-up w-full"
          style={{ animationDelay: "160ms" }}
        >
          {children}
        </main>
      </div>

      <ToasterWrapper />
    </div>
  );
}
