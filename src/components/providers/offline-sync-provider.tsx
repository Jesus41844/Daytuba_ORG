"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@/components/ui/toast";
import { flushQueue } from "@/lib/offline-queue";

/**
 * Vacía la cola de mutaciones offline (src/lib/offline-queue.ts) cuando: la
 * app arranca (por si quedaron mutaciones de la sesión anterior), vuelve la
 * conexión, la pestaña vuelve a primer plano, o el service worker avisa vía
 * el evento "sync" de Background Sync. Este último solo dispara en
 * Chrome/Edge; los otros tres cubren Safari/iOS también.
 */
export function OfflineSyncProvider() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function runFlush() {
      const outcome = await flushQueue().catch(() => null);
      if (!outcome || cancelled) return;

      if (outcome.conflicts.length > 0) {
        toast.add({
          title: "Algunas tareas cambiaron en el servidor",
          description:
            "Se descartó el cambio hecho sin conexión para no pisar la versión más reciente. Revísalas.",
          type: "warning",
        });
      }
      if (outcome.failed.length > 0) {
        toast.add({
          title: "No se pudieron sincronizar algunos cambios",
          description: "Revisa esas tareas y vuelve a intentarlo manualmente.",
          type: "error",
        });
      }
      if (outcome.applied.length > 0) {
        router.refresh();
      }
    }

    void runFlush();

    function handleOnline() {
      void runFlush();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") void runFlush();
    }

    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "FLUSH_QUEUE") void runFlush();
    }

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleMessage);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleMessage);
      }
    };
  }, [router]);

  return null;
}
