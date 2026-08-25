"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { loginSchema, type LoginInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

import { useLogin } from "../hooks";

function SubmitButton() {
  const { pending } = useLogin();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
      Entrar
    </Button>
  );
}

export function LoginForm() {
  const { login } = useLogin();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginInput) {
    const result = await login(data);

    if (result.success) {
      toast.add({
        type: "success",
        title: "Bienvenido",
        description: "Sesión iniciada correctamente.",
      });
    } else {
      toast.add({
        type: "error",
        title: "No se pudo iniciar sesión",
        description: result.error,
      });
    }
  }

  return (
    <div className="w-full space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@utp.ac.pa"
            autoComplete="email"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>
        <SubmitButton />
      </form>
      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes una cuenta?{" "}
        <Link
          href="/register"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Crea tu cuenta
        </Link>
      </p>
    </div>
  );
}
