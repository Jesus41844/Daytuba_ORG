"use client";

import { useEffect } from "react";

import { getPendingBadgeCount } from "@/features/tasks/queries";

const POLL_INTERVAL_MS = 60_000;

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function BadgeProvider() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as NavigatorWithBadge;
    if (!nav.setAppBadge || !nav.clearAppBadge) return;

    let cancelled = false;

    async function updateBadge() {
      try {
        const count = await getPendingBadgeCount();
        if (cancelled) return;
        if (count > 0) {
          await nav.setAppBadge!(count);
        } else {
          await nav.clearAppBadge!();
        }
      } catch {
        // el Badge API es mejora progresiva: nunca debe romper la app
      }
    }

    void updateBadge();
    const timer = setInterval(() => void updateBadge(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return null;
}
