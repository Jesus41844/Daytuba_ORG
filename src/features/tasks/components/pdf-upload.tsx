"use client";

import { useState, useRef } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { uploadPdfToBlob } from "@/lib/blob-client";
import { taskPdfPathname } from "@/lib/blob-paths";
import { Button } from "@/components/ui/button";
import { confirmTaskPdfUpload, deleteTaskPdf } from "@/features/files/actions";
import { parsePdf, type ParsedPdf } from "@/lib/pdf";

interface PdfUploadProps {
  taskId: string;
  currentPdfUrl: string | null;
  currentPdfName: string | null;
  onUploadComplete?: (url: string, name: string, parsed?: ParsedPdf) => void;
  onDeleteComplete?: () => void;
}

export function PdfUpload({
  taskId,
  currentPdfUrl,
  currentPdfName,
  onUploadComplete,
  onDeleteComplete,
}: PdfUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const result = await uploadPdfToBlob({
        file,
        pathname: taskPdfPathname(taskId, file.name),
        clientPayload: JSON.stringify({ kind: "task", id: taskId }),
        confirm: (url, name) => confirmTaskPdfUpload(taskId, url, name),
      });
      if (!result.success) {
        setError(result.error ?? "Error al subir el PDF");
        return;
      }

      let parsed: ParsedPdf | undefined;
      try {
        parsed = await parsePdf(file);
      } catch (parseErr) {
        console.warn("Could not parse PDF:", parseErr);
      }

      onUploadComplete?.(result.data.url, result.data.name, parsed);
    } catch (err) {
      setError("Error al subir el archivo");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const result = await deleteTaskPdf(taskId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onDeleteComplete?.();
    } catch (err) {
      setError("Error al eliminar el PDF");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      {currentPdfUrl && currentPdfName ? (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 p-3">
          <FileText className="h-4 w-4 text-primary" />
          <a
            href={currentPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 truncate text-sm font-medium hover:underline"
          >
            {currentPdfName}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 rounded-xl border-dashed"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? "Subiendo..." : "Adjuntar PDF"}
        </Button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
