"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { changePassword } from "../actions";

const passwordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres"),
    newPassword: z
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type PasswordInput = z.infer<typeof passwordSchema>;

export function PasswordForm() {
  const [isPending, setIsPending] = useState(false);

  const form = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: PasswordInput) {
    setIsPending(true);
    try {
      const result = await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      if (result.success) {
        toast.add({
          type: "success",
          title: "Contraseña cambiada",
          description: "Tu contraseña se actualizó correctamente.",
        });
        form.reset();
      } else {
        toast.add({
          type: "error",
          title: "Error",
          description: result.error,
        });
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="current-password">Contraseña actual</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          {...form.register("currentPassword")}
        />
        {form.formState.errors.currentPassword && (
          <p className="text-xs text-destructive">
            {form.formState.errors.currentPassword.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">Nueva contraseña</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          {...form.register("newPassword")}
        />
        {form.formState.errors.newPassword && (
          <p className="text-xs text-destructive">
            {form.formState.errors.newPassword.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">Confirmar contraseña</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Cambiar contraseña
        </Button>
      </div>
    </form>
  );
}
