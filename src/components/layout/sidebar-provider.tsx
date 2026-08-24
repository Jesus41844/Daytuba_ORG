"use client";

import * as React from "react";

const STORAGE_KEY = "daytuba-sidebar-width";
const COLLAPSED_KEY = "daytuba-sidebar-collapsed";
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 260;
const COLLAPSE_THRESHOLD = 160;

type SidebarContextValue = {
  width: number;
  collapsed: boolean;
  setWidth: (w: number) => void;
  collapse: () => void;
  expand: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue>({
  width: DEFAULT_WIDTH,
  collapsed: false,
  setWidth: () => {},
  collapse: () => {},
  expand: () => {},
});

export function useSidebarWidth() {
  return React.useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [width, setWidthState] = React.useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const storedWidth = localStorage.getItem(STORAGE_KEY);
    const storedCollapsed = localStorage.getItem(COLLAPSED_KEY);
    if (storedCollapsed === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync localStorage → state on mount
      setCollapsed(true);
    } else if (storedWidth) {
      const parsed = Number(storedWidth);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        setWidthState(parsed);
      }
    }
    setReady(true);
  }, []);

  const setWidth = React.useCallback((newWidth: number) => {
    if (newWidth < COLLAPSE_THRESHOLD) {
      setCollapsed(true);
      localStorage.setItem(COLLAPSED_KEY, "true");
    } else {
      const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
      setWidthState(clamped);
      setCollapsed(false);
      localStorage.setItem(STORAGE_KEY, String(clamped));
      localStorage.removeItem(COLLAPSED_KEY);
    }
  }, []);

  const collapse = React.useCallback(() => {
    setCollapsed(true);
    localStorage.setItem(COLLAPSED_KEY, "true");
  }, []);

  const expand = React.useCallback(() => {
    setCollapsed(false);
    setWidth(DEFAULT_WIDTH);
    localStorage.removeItem(COLLAPSED_KEY);
    localStorage.setItem(STORAGE_KEY, String(DEFAULT_WIDTH));
  }, [setWidth]);

  if (!ready) {
    return (
      <SidebarContext.Provider
        value={{
          width: DEFAULT_WIDTH,
          collapsed: false,
          setWidth: () => {},
          collapse: () => {},
          expand: () => {},
        }}
      >
        {children}
      </SidebarContext.Provider>
    );
  }

  return (
    <SidebarContext.Provider
      value={{ width, collapsed, setWidth, collapse, expand }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
