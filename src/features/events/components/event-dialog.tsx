"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EVENT_COLORS, type CalendarEvent } from "../types";
import {
  createEvent,
  updateEvent,
  deleteEvent,
} from "../actions";
import { DAY_NAMES } from "@/features/schedule/types";

type EventDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (event: CalendarEvent) => void;
  onDeleted?: (id: string) => void;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialDayOfWeek?: number;
  editingEvent?: CalendarEvent | null;
};

function getInitialValues(props: {
  editingEvent?: CalendarEvent | null;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialDayOfWeek?: number;
}) {
  const { editingEvent, initialDate, initialStartTime, initialEndTime, initialDayOfWeek } = props;
  if (editingEvent) {
    return {
      title: editingEvent.title,
      date: editingEvent.date ?? "",
      dayOfWeek: editingEvent.dayOfWeek ?? 1,
      isRecurring: editingEvent.dayOfWeek !== null,
      startTime: editingEvent.startTime,
      endTime: editingEvent.endTime,
      color: editingEvent.color,
    };
  }
  return {
    title: "",
    date: initialDate ?? "",
    dayOfWeek: initialDayOfWeek ?? new Date().getDay(),
    isRecurring: initialDayOfWeek !== undefined && initialDate === undefined,
    startTime: initialStartTime ?? "09:00",
    endTime: initialEndTime ?? "10:00",
    color: EVENT_COLORS[0],
  };
}

export function EventDialogInner({
  onClose,
  onSaved,
  onDeleted,
  editingEvent,
  ...initialProps
}: EventDialogProps) {
  const isEditing = !!editingEvent;
  const init = getInitialValues({ editingEvent, ...initialProps });

  const [title, setTitle] = useState(init.title);
  const [date, setDate] = useState(init.date);
  const [dayOfWeek, setDayOfWeek] = useState<number>(init.dayOfWeek);
  const [isRecurring, setIsRecurring] = useState(init.isRecurring);
  const [startTime, setStartTime] = useState(init.startTime);
  const [endTime, setEndTime] = useState(init.endTime);
  const [color, setColor] = useState<string>(init.color);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);

    try {
      const payload = {
        title: title.trim(),
        startTime,
        endTime,
        color,
        date: isRecurring ? null : date || null,
        dayOfWeek: isRecurring ? dayOfWeek : null,
      };

      if (isEditing && editingEvent) {
        const result = await updateEvent(editingEvent.id, payload);
        if (result.success) onSaved(result.data);
      } else {
        const result = await createEvent(payload);
        if (result.success) onSaved(result.data);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingEvent) return;
    setDeleting(true);
    try {
      const result = await deleteEvent(editingEvent.id);
      if (result.success && onDeleted) onDeleted(editingEvent.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-background border border-border/50 shadow-xl p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Editar evento" : "Nuevo evento"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="evt-title">Titulo</Label>
            <Input
              id="evt-title"
              placeholder="ej: Reunion de proyecto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-border"
              />
              Repetir cada semana
            </label>
          </div>

          {isRecurring ? (
            <div className="flex flex-col gap-2">
              <Label>Dia de la semana</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_NAMES.map((name, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDayOfWeek(i)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      dayOfWeek === i
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border/60 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {name.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="evt-date">Fecha</Label>
              <Input
                id="evt-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="evt-start">Inicio</Label>
              <Input
                id="evt-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="evt-end">Fin</Label>
              <Input
                id="evt-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Color</Label>
            <div className="flex gap-1.5">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${
                    color === c
                      ? "scale-110 border-foreground"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
          {isEditing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="text-destructive hover:text-destructive"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {isEditing ? "Guardar" : "Crear"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

let dialogKey = 0;

export function EventDialog(props: EventDialogProps) {
  if (!props.open) return null;

  const key = ++dialogKey;
  return createPortal(
    <EventDialogInner key={key} {...props} />,
    document.body
  );
}
