"use client";

import { Camera, Loader2, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  deleteProfilePhoto,
  uploadProfilePhoto,
  updateUserProfile,
} from "@/features/auth/actions";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ProfileForm({
  initialName,
  initialPhotoUrl,
}: {
  initialName?: string;
  initialPhotoUrl?: string;
}) {
  const [displayName, setDisplayName] = useState(initialName ?? "");
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [requestDelete, setRequestDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasCurrentPhoto = Boolean(initialPhotoUrl);
  const showPhoto = requestDelete
    ? false
    : photoPreview ?? (hasCurrentPhoto ? initialPhotoUrl : null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.add({
        type: "error",
        title: "Imagen demasiado grande",
        description: "La imagen no puede superar 4 MB.",
      });
      return;
    }
    setPhotoFile(file);
    setRequestDelete(false);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  }

  function onDeletePhoto() {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setRequestDelete(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (photoFile) {
        const fd = new FormData();
        fd.append("file", photoFile);
        const result = await uploadProfilePhoto(fd.get("file") as File);
        if (!result.success) {
          toast.add({
            type: "error",
            title: "Error al subir la foto",
            description: result.error,
          });
          return;
        }
        setPhotoPreview(null);
        setPhotoFile(null);
        window.location.reload();
        return;
      }

      if (requestDelete && hasCurrentPhoto) {
        const result = await deleteProfilePhoto();
        if (!result.success) {
          toast.add({
            type: "error",
            title: "Error al borrar la foto",
            description: result.error,
          });
          return;
        }
        window.location.reload();
        return;
      }

      const nameChanged = displayName !== (initialName ?? "");
      if (nameChanged) {
        const result = await updateUserProfile({ displayName });
        if (!result.success) {
          toast.add({
            type: "error",
            title: "Error al guardar",
            description: result.error,
          });
          return;
        }
      }

      toast.add({
        type: "success",
        title: "Perfil actualizado",
      });
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  const nameChanged = displayName !== (initialName ?? "");
  const hasPendingChanges = nameChanged || photoFile !== null || requestDelete;

  return (
    <div className="space-y-8">
      {/* ── Avatar section ───────────────────────────────── */}
      <div className="flex items-center gap-6">
        <div className="relative shrink-0">
          <div
            className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-border"
            style={{ background: "var(--muted)" }}
          >
            {showPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={showPhoto}
                alt="Foto de perfil"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground select-none">
                {getInitials(initialName)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="mr-2 h-4 w-4" />
            Cambiar foto
          </Button>
          {hasCurrentPhoto && !requestDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={onDeletePhoto}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Borrar foto
            </Button>
          )}
          {requestDelete && (
            <p className="text-xs text-destructive">
              Foto marcada para borrar. Pulsa &quot;Guardar&quot; para
              confirmar.
            </p>
          )}
          {photoFile && (
            <p className="text-xs text-muted-foreground">
              Foto nueva seleccionada. Pulsa &quot;Guardar&quot; para subir.
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPickFile}
          />
        </div>
      </div>

      {/* ── Name field ───────────────────────────────────── */}
      <div className="space-y-2">
        <Label htmlFor="displayName">Nombre</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Tu nombre"
          disabled={saving}
        />
      </div>

      {/* ── Save ─────────────────────────────────────────── */}
      <Button onClick={handleSave} disabled={saving || !hasPendingChanges}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <Pencil className="mr-2 h-4 w-4" />
            Guardar cambios
          </>
        )}
      </Button>
    </div>
  );
}
