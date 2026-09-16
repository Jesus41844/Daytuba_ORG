"use client";

import { useEffect, useRef } from "react";

const SUBSCRIBED_KEY = "utp:push-subscribed";

export function PushProvider() {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (registeredRef.current) return;
    registeredRef.current = true;

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;

    async function register() {
      try {
        if (Notification.permission !== "granted") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
        }

        if (localStorage.getItem(SUBSCRIBED_KEY)) return;

        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          localStorage.setItem(SUBSCRIBED_KEY, "1");
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });

        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys) return;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          }),
        });
        localStorage.setItem(SUBSCRIBED_KEY, "1");
      } catch {
        // non-fatal: push subscription must never break the app
      }
    }

    void register();
  }, []);

  return null;
}