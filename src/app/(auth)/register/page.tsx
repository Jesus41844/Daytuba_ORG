import type { Metadata } from "next";

import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = {
  title: "Crear cuenta | Daytuba",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
