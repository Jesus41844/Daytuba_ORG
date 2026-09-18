"use client";

import * as React from "react";
import { Bell, Mail } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import {
  updateReminderPreferences,
} from "@/features/notifications/actions";
import type { ReminderPreferences } from "@/features/notifications/queries";

export function ReminderPreferences({
  initial,
}: {
  initial: ReminderPreferences;
}) {
  const [push, setPush] = React.useState(initial.reminderPush);
  const [email, setEmail] = React.useState(initial.reminderEmail);
  const [saved, setSaved] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  async function save(next: {
    reminderPush?: boolean;
    reminderEmail?: boolean;
  }) {
    const reminderPush = next.reminderPush ?? push;
    const reminderEmail = next.reminderEmail ?? email;
    const result = await updateReminderPreferences({
      reminderPush,
      reminderEmail,
    });
    if (result.success) {
      setSaved(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setSaved(false), 2000);
    }
  }

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Notificaciones push</span>
            <span className="text-xs text-muted-foreground">
              Recibe el recordatorio al instante en tu dispositivo mientras
              usas la app.
            </span>
          </div>
        </div>
        <Switch
          checked={push}
          onCheckedChange={(checked) => {
            setPush(checked);
            void save({ reminderPush: checked });
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Email</span>
            <span className="text-xs text-muted-foreground">
              Recibe un correo con el recordatorio en tu bandeja de entrada.
            </span>
          </div>
        </div>
        <Switch
          checked={email}
          onCheckedChange={(checked) => {
            setEmail(checked);
            void save({ reminderEmail: checked });
          }}
        />
      </div>

      <p
        aria-live="polite"
        className="text-xs text-muted-foreground"
      >
        {saved
          ? "Preferencias guardadas"
          : "Los recordatorios se envían solos al cumplirse la hora (rápido con la app abierta; barrido diario si no)."}
      </p>
    </div>
  );
}