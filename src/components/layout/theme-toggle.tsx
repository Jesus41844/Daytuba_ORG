"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  function cycle() {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const nextIndex = (order.indexOf(theme) + 1) % order.length;
    setTheme(order[nextIndex]!);
  }

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label =
    theme === "light"
      ? "Modo claro (actual)"
      : theme === "dark"
        ? "Modo oscuro (actual)"
        : "Detectar sistema (actual)";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      aria-label={label}
      className={className}
    >
      <Icon className="size-4" />
    </Button>
  );
}
