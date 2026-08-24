"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Link as LinkIcon,
  Unlink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MOODLE_PLATFORMS,
  type MoodlePlatform,
  type MoodleCredentials,
  type MoodleSyncResult,
} from "../types";
import {
  saveMoodleCredentials,
  deleteMoodleCredentials,
  getUserMoodleCredentials,
  syncMoodlePlatform,
} from "../actions";

const PLATFORM_KEYS: MoodlePlatform[] = ["ecampus", "campusvirtual", "virtualutp"];

export function MoodleSettings() {
  const [credentials, setCredentials] = useState<MoodleCredentials[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<MoodlePlatform[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<MoodleSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUserMoodleCredentials().then((creds) => {
      setCredentials(creds);
      setLoading(false);
    });
  }, []);

  function togglePlatform(platform: MoodlePlatform) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }

  async function handleSave() {
    if (!username.trim() || !password.trim() || selectedPlatforms.length === 0) return;
    setSaving(true);
    setError(null);

    try {
      const newCreds: MoodleCredentials[] = [];
      for (const platform of selectedPlatforms) {
        const result = await saveMoodleCredentials(platform, username.trim(), password);
        if (result.success) {
          newCreds.push(result.data);
        } else {
          setError(result.error);
          return;
        }
      }

      setCredentials((prev) => {
        const ids = new Set(newCreds.map((c) => c.id));
        const kept = prev.filter((c) => !ids.has(c.id));
        return [...kept, ...newCreds];
      });

      setUsername("");
      setPassword("");
      setSelectedPlatforms([]);
    } catch {
      setError("Error al guardar credenciales");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync(credId: string) {
    setSyncingId(credId);
    setSyncResult(null);
    setError(null);

    try {
      const result = await syncMoodlePlatform(credId);
      if (result.success) {
        setSyncResult(result.data);
        setCredentials((prev) =>
          prev.map((c) =>
            c.id === credId
              ? { ...c, lastSyncAt: new Date().toISOString() }
              : c
          )
        );
      } else {
        setError(result.error);
      }
    } catch {
      setError("Error al sincronizar");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete(credId: string) {
    const result = await deleteMoodleCredentials(credId);
    if (result.success) {
      setCredentials((prev) => prev.filter((c) => c.id !== credId));
    }
  }

  function getLinkedPlatforms(): MoodlePlatform[] {
    return credentials.map((c) => c.platform);
  }

  function formatLastSync(dateStr: string | null): string {
    if (!dateStr) return "Nunca";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Ahora mismo";
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Hace ${diffH}h`;
    return date.toLocaleDateString("es-PA", { day: "numeric", month: "short" });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {credentials.length > 0 && (
        <div className="flex flex-col gap-2">
          {credentials.map((cred) => {
            const platform = MOODLE_PLATFORMS[cred.platform];
            const isSyncing = syncingId === cred.id;
            return (
              <div
                key={cred.id}
                className="flex items-center gap-3 rounded-xl border border-border/40 p-3"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <LinkIcon className="size-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {platform.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cred.username} · Última sync: {formatLastSync(cred.lastSyncAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleSync(cred.id)}
                    disabled={isSyncing}
                    title="Sincronizar"
                  >
                    {isSyncing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(cred.id)}
                    title="Desvincular"
                    className="text-destructive hover:text-destructive"
                  >
                    <Unlink className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {syncResult && (
        <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">
              Sincronizado: {MOODLE_PLATFORMS[syncResult.platform].label}
            </p>
            <p className="text-muted-foreground">
              {syncResult.courses} cursos, {syncResult.assignments} tareas encontradas
              {syncResult.errors.length > 0 &&
                ` · ${syncResult.errors.length} errores`}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="border-t border-border/40 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          {credentials.length > 0 ? "Agregar otra plataforma" : "Vincular cuenta UTP"}
        </h4>

        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="moodle-user">Usuario UTP</Label>
              <Input
                id="moodle-user"
                placeholder="ej: jperez12345"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="moodle-pass">Contraseña UTP</Label>
              <Input
                id="moodle-pass"
                type="password"
                placeholder="Tu contraseña UTP"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Plataformas</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_KEYS.map((key) => {
                const p = MOODLE_PLATFORMS[key];
                const linked = getLinkedPlatforms().includes(key);
                const selected = selectedPlatforms.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={linked}
                    onClick={() => togglePlatform(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      linked
                        ? "border-primary/30 bg-primary/5 text-primary cursor-not-allowed opacity-60"
                        : selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {p.label}
                    {linked && " ✓"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={
                saving ||
                !username.trim() ||
                !password.trim() ||
                selectedPlatforms.length === 0
              }
            >
              {saving ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <LinkIcon className="mr-1.5 size-3.5" />
              )}
              Vincular
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
