"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { registerSchema, type RegisterInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

import { useRegister } from "../hooks";

function SubmitButton() {
  const { pending } = useRegister();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
      Crear cuenta
    </Button>
  );
}

export function RegisterForm() {
  const { register } = useRegister();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: RegisterInput) {
    const result = await register(data);

    if (result.success) {
      toast.add({
        type: "success",
        title: "Cuenta creada",
        description: `¡Bienvenido, ${data.displayName}!`,
      });
    } else {
      toast.add({
        type: "error",
        title: "No se pudo crear la cuenta",
        description: result.error,
      });
    }
  }

  return (
    <div className="w-full space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="displayName">Nombre</Label>
          <Input
            id="displayName"
            type="text"
            placeholder="Juan Pérez"
            autoComplete="name"
            {...form.register("displayName")}
          />
          {form.formState.errors.displayName && (
            <p className="text-sm text-destructive">
              {form.formState.errors.displayName.message}
            </p>
          )}
        </div>
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
            autoComplete="new-password"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword && (
            <p className="text-sm text-destructive">
              {form.formState.errors.confirmPassword.message}
            </p>
          )}
        </div>
        <SubmitButton />
      </form>
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes una cuenta?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
