"use client";

import { useState } from "react";

import { ScheduleManager } from "@/features/tasks/components/schedule-manager";
import type { ScheduleBlock } from "@/features/schedule/types";

export function ScheduleManagerPage({
  initial,
}: {
  initial: ScheduleBlock[];
}) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>(initial);

  return (
    <ScheduleManager
      blocks={blocks}
      onCreated={(block) => setBlocks((prev) => [...prev, block])}
      onDeleted={(id) =>
        setBlocks((prev) => prev.filter((b) => b.id !== id))
      }
      onUpdated={(block) =>
        setBlocks((prev) => prev.map((b) => (b.id === block.id ? block : b)))
      }
    />
  );
}