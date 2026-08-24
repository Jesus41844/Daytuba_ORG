"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { updateUserProfile } from "../actions";

const profileSchema = z.object({
  displayName: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100),
  photoUrl: z.string().url("URL inválida").optional().or(z.literal("")),
});

type ProfileInput = z.infer<typeof profileSchema>;

type ProfileFormProps = {
  initialName: string;
  initialPhotoUrl: string;
};

export function ProfileForm({ initialName, initialPhotoUrl }: ProfileFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: initialName,
      photoUrl: initialPhotoUrl,
    },
  });

  async function onSubmit(data: ProfileInput) {
    setIsPending(true);
    try {
      const result = await updateUserProfile({
        displayName: data.displayName,
        photoUrl: data.photoUrl || undefined,
      });

      if (result.success) {
        toast.add({
          type: "success",
          title: "Perfil actualizado",
          description: "Tu perfil se guardó correctamente.",
        });
        router.refresh();
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
        <Label htmlFor="profile-name">Nombre</Label>
        <Input
          id="profile-name"
          placeholder="Tu nombre"
          {...form.register("displayName")}
        />
        {form.formState.errors.displayName && (
          <p className="text-xs text-destructive">
            {form.formState.errors.displayName.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-photo">Foto de perfil (URL)</Label>
        <Input
          id="profile-photo"
          placeholder="https://ejemplo.com/foto.jpg"
          {...form.register("photoUrl")}
        />
        {form.formState.errors.photoUrl && (
          <p className="text-xs text-destructive">
            {form.formState.errors.photoUrl.message}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Guardar
        </Button>
      </div>
    </form>
  );
}
