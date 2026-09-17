"use client";

import { useEffect } from "react";

export function PwaProvider() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    function register() {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // offline support is best-effort and must never break the app
      });
    }

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
