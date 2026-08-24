"use client";

import * as React from "react";
import { useSidebarWidth } from "./sidebar-provider";

export function SidebarWidthUpdater() {
  const { width, collapsed } = useSidebarWidth();

  React.useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      collapsed ? "64px" : `${width}px`
    );
  }, [width, collapsed]);

  return null;
}
