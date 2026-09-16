"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { TaskComment } from "@/types";
import { createComment, deleteComment } from "../actions";

type TaskCommentsProps = {
  taskId: string;
  comments: TaskComment[];
  currentUserId: string;
  canComment: boolean;
};

function timeAgo(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(value).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
  });
}

export function TaskComments({
  taskId,
  comments: initialComments,
  currentUserId,
  canComment,
}: TaskCommentsProps) {
  const router = useRouter();
  const [comments, setComments] = useState<TaskComment[]>(initialComments);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await createComment({
        taskId,
        body: body.trim(),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setComments((prev) => [...prev, result.data]);
      setBody("");
      router.refresh();
    });
  }

  function handleDelete(commentId: string) {
    if (!window.confirm("¿Eliminar este comentario?")) return;
    setPendingId(commentId);
    startTransition(async () => {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Comentarios</h3>
        <span className="text-xs text-muted-foreground">
          {comments.length}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hay comentarios todavía.
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {(comment.authorName || comment.authorEmail).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 rounded-lg bg-muted/60 px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold">
                    {comment.authorName || comment.authorEmail}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">
                  {comment.body}
                </p>
              </div>
              {comment.userId === currentUserId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={pendingId === comment.id}
                  onClick={() => handleDelete(comment.id)}
                  title="Eliminar comentario"
                  aria-label="Eliminar comentario"
                >
                  {pendingId === comment.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {canComment && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribe un comentario..."
            className="flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isPending || !body.trim()}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Comentar
          </Button>
        </form>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}