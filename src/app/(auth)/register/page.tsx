import type { Metadata } from "next";

import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = {
  title: "Crear Cuenta | Daytuba Tasks",
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Crear cuenta
          </h1>
          <p className="text-sm text-muted-foreground">Daytuba Tasks</p>
        </div>
        <RegisterForm />
      </div>
    </main>
  );
}
