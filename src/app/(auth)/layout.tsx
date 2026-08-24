import * as React from "react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-gradient-to-b from-primary/8 via-background to-background px-4 py-10">
      <Link
        href="/"
        className="mb-8 flex flex-col items-center gap-2"
        aria-label="Daytuba - Inicio"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-sm">
          U
        </span>
        <span className="text-lg font-bold tracking-tight">Daytuba</span>
      </Link>
      <main className="w-full max-w-sm">{children}</main>
    </div>
  );
}
