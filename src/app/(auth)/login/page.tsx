import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = {
  title: "Entrar | Daytuba",
};

export default function LoginPage() {
  return <LoginForm />;
}
