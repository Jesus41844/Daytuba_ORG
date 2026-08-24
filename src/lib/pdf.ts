export interface ParsedPdf {
  title: string;
  hours: number | null;
  text: string;
}

export async function parsePdf(file: File): Promise<ParsedPdf> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += pageText + "\n";
  }

  const title = extractTitle(fullText, file.name);
  const hours = extractHours(fullText);

  return { title, hours, text: fullText.trim() };
}

function extractTitle(text: string, fileName: string): string {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  for (const line of lines.slice(0, 5)) {
    const cleaned = line.trim();
    if (cleaned.length > 3 && cleaned.length < 200) {
      if (/^(curso|asignatura|materia|tema|práctica|laboratorio|parcial|final)/i.test(cleaned)) {
        return cleaned.replace(/^[:\-\s]+/, "").trim();
      }
    }
  }

  for (const line of lines.slice(0, 3)) {
    const cleaned = line.trim();
    if (cleaned.length > 3 && cleaned.length < 150) {
      return cleaned;
    }
  }

  return fileName.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
}

function extractHours(text: string): number | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:horas?|hrs?|hours?)\s*(?:de\s+)?(?:clase|teoría|práctica|laboratorio)?/i,
    /(?:horas?|hrs?|hours?)\s*[:=]\s*(\d+(?:\.\d+)?)/i,
    /(?:carga\s+horaria|total)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:horas?|hrs?)?/i,
    /(\d+(?:\.\d+)?)\s*(?:ch|sh|th)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const hours = parseFloat(match[1]);
      if (hours > 0 && hours <= 100) {
        return hours;
      }
    }
  }

  return null;
}
