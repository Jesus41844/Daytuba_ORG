"use client";

import { useState, useRef } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  FileText,
  Upload,
  X,
  FileUp,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ScheduleBlock, DayOfWeek } from "@/features/schedule/types";
import { DAY_NAMES, SCHEDULE_COLORS } from "@/features/schedule/types";
import {
  createScheduleBlock,
  deleteScheduleBlock,
  parseSchedulePdf,
} from "@/features/schedule/actions";
import type { ParsedScheduleEntry } from "@/lib/schedule-pdf";
import {
  uploadScheduleBlockPdf,
  deleteScheduleBlockPdf,
} from "@/features/files/actions";

type ScheduleManagerProps = {
  blocks: ScheduleBlock[];
  onCreated: (block: ScheduleBlock) => void;
  onDeleted: (id: string) => void;
  onUpdated: (block: ScheduleBlock) => void;
};

const ENTRY_COLORS = [
  "#0b57d0",
  "#0d652d",
  "#c5221f",
  "#e37400",
  "#7b1fa2",
  "#00838f",
  "#ad1457",
  "#4e3524",
];

export function ScheduleManager({
  blocks,
  onCreated,
  onDeleted,
  onUpdated,
}: ScheduleManagerProps) {
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDay, setNewDay] = useState<DayOfWeek>(1);
  const [newStart, setNewStart] = useState("08:00");
  const [newEnd, setNewEnd] = useState("10:00");
  const [newColor, setNewColor] = useState("#0b57d0");

  const [parsing, setParsing] = useState(false);
  const [parsedEntries, setParsedEntries] = useState<ParsedScheduleEntry[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const result = await createScheduleBlock({
        name: newName.trim(),
        dayOfWeek: newDay,
        startTime: newStart,
        endTime: newEnd,
        color: newColor,
        pdfUrl: null,
        pdfName: null,
      });
      if (result.success) {
        onCreated(result.data);
        setNewName("");
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const result = await deleteScheduleBlock(id);
      if (result.success) {
        onDeleted(id);
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setParseError(null);
    setParsedEntries(null);

    try {
      const formData = new FormData();
      formData.set("pdf", file);
      const result = await parseSchedulePdf(formData);
      if (!result.success) {
        setParseError(result.error);
        return;
      }
      if (result.data.length === 0) {
        setParseError(
          "No se pudieron extraer horarios del PDF. Asegurate de que contenga una tabla de horarios con materias, dias y horas."
        );
      } else {
        setParsedEntries(result.data);
      }
    } catch {
      setParseError("Error al leer el PDF. Intenta con otro archivo.");
    } finally {
      setParsing(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  async function handleImportParsed() {
    if (!parsedEntries || parsedEntries.length === 0) return;
    setImporting(true);

    try {
      const subjectColors = new Map<string, string>();
      let colorIndex = 0;

      for (const entry of parsedEntries) {
        if (!subjectColors.has(entry.subject)) {
          subjectColors.set(
            entry.subject,
            ENTRY_COLORS[colorIndex % ENTRY_COLORS.length]!
          );
          colorIndex++;
        }
      }

      for (const entry of parsedEntries) {
        const color = subjectColors.get(entry.subject) ?? "#0b57d0";
        const result = await createScheduleBlock({
          name: entry.subject,
          dayOfWeek: entry.dayOfWeek as DayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
          color,
          pdfUrl: null,
          pdfName: null,
        });
        if (result.success) {
          onCreated(result.data);
        }
      }

      setParsedEntries(null);
    } finally {
      setImporting(false);
    }
  }

  function groupedParsed() {
    if (!parsedEntries) return null;
    const groups = new Map<string, ParsedScheduleEntry[]>();
    for (const entry of parsedEntries) {
      const key = entry.subject;
      const existing = groups.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        groups.set(key, [entry]);
      }
    }
    return groups;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <FileUp className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Importar horario desde PDF</p>
            <p className="text-xs text-muted-foreground">
              Subi el PDF de tu horario y la web detectara las materias y horarios
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => pdfInputRef.current?.click()}
            disabled={parsing}
            className="shrink-0"
          >
            {parsing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            Subir PDF
          </Button>
        </div>

        <input
          ref={pdfInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handlePdfUpload}
        />

        {parseError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {parseError}
          </div>
        )}

        {parsedEntries && parsedEntries.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Se detectaron {parsedEntries.length} bloques:
            </p>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {Array.from(groupedParsed()!.entries()).map(
                ([subject, entries], idx) => (
                  <div
                    key={subject}
                    className="rounded-lg border border-border/40 p-2.5"
                  >
                    <p
                      className="text-xs font-semibold"
                      style={{
                        color: ENTRY_COLORS[idx % ENTRY_COLORS.length],
                      }}
                    >
                      {subject}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entries.map((e, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {DAY_NAMES[e.dayOfWeek]} {e.startTime}–{e.endTime}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setParsedEntries(null)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleImportParsed}
                disabled={importing}
              >
                {importing ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                )}
                Importar {parsedEntries.length} bloques
              </Button>
            </div>
          </div>
        )}
      </div>

      <h3 className="text-sm font-semibold">Agregar manualmente</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sch-name">Nombre</Label>
          <Input
            id="sch-name"
            placeholder="ej: Calculo I"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Dia</Label>
          <Select
            value={String(newDay)}
            onValueChange={(v) => setNewDay(Number(v) as DayOfWeek)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_NAMES.map((name: string, i: number) => (
                <SelectItem key={i} value={String(i)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sch-start">Inicio</Label>
          <Input
            id="sch-start"
            type="time"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sch-end">Fin</Label>
          <Input
            id="sch-end"
            type="time"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Color</Label>
        <div className="flex gap-1.5">
          {SCHEDULE_COLORS.map((color: string) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${
                newColor === color
                  ? "scale-110 border-foreground"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setNewColor(color)}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Agregar
        </Button>
      </div>

      {blocks.length > 0 && (
        <div className="space-y-3 border-t border-border/40 pt-4">
          {DAY_NAMES.map((dayName: string, dayIndex: number) => {
            const dayBlocks = blocks
              .filter((b) => b.dayOfWeek === dayIndex)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            if (dayBlocks.length === 0) return null;
            return (
              <div key={dayIndex} className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {dayName}
                </p>
                <div className="flex flex-col gap-1.5">
                  {dayBlocks.map((block) => (
                    <BlockRow
                      key={block.id}
                      block={block}
                      deletingId={deletingId}
                      onDelete={handleDelete}
                      onUpdated={onUpdated}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BlockRow({
  block,
  deletingId,
  onDelete,
  onUpdated,
}: {
  block: ScheduleBlock;
  deletingId: string | null;
  onDelete: (id: string) => void;
  onUpdated: (block: ScheduleBlock) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadScheduleBlockPdf(block.id, file);
      if (result.success) {
        onUpdated({
          ...block,
          pdfUrl: result.data.url,
          pdfName: result.data.name,
        });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeletePdf() {
    setUploading(true);
    try {
      const result = await deleteScheduleBlockPdf(block.id);
      if (result.success) {
        onUpdated({ ...block, pdfUrl: null, pdfName: null });
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border/40 p-3">
      <div
        className="h-8 w-1 rounded-full shrink-0"
        style={{ backgroundColor: block.color }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{block.name}</p>
        <p className="text-xs text-muted-foreground">
          {block.startTime}–{block.endTime}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleUpload}
      />

      {block.pdfUrl ? (
        <div className="flex items-center gap-1.5">
          <a
            href={block.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
            title={block.pdfName ?? "Ver PDF"}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </a>
          <button
            type="button"
            aria-label="Eliminar PDF"
            onClick={handleDeletePdf}
            disabled={uploading}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label="Subir PDF"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          PDF
        </button>
      )}

      <button
        type="button"
        aria-label={`Eliminar ${block.name}`}
        onClick={() => onDelete(block.id)}
        disabled={deletingId === block.id}
        className="text-muted-foreground hover:text-destructive transition-colors"
      >
        {deletingId === block.id ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Trash2 className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
