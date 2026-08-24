import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock, Palette, UserRound, BookOpen } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { PasswordForm } from "@/features/auth/components/password-form";
import { MoodleSettings } from "@/features/moodle/components/moodle-settings";

export const metadata: Metadata = {
  title: "Configuración | Daytuba Tasks",
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        title="Configuración"
        description={`Sesión activa como ${session.email}.`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserRound className="size-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-base">Perfil</CardTitle>
            <CardDescription>
              Actualiza tu nombre y foto de perfil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              initialName={session.displayName}
              initialPhotoUrl={session.photoUrl ?? ""}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="size-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-base">Contraseña</CardTitle>
            <CardDescription>
              Cambia tu contraseña de acceso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-base">Plataformas UTP</CardTitle>
          <CardDescription>
            Vincula tus cuentas de Moodle para sincronizar asignaciones
            automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MoodleSettings />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="size-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-base">Apariencia</CardTitle>
          <CardDescription>
            Configura el tema visual de la aplicación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Usa el botón de tema en la barra lateral para cambiar entre modo
            claro, oscuro o sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
