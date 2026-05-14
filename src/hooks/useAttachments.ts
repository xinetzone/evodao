import { useState, useCallback } from "react";

export interface Attachment {
  id: string;
  file: File;
  name: string;
  type: "image" | "document";
  size: number;
  previewUrl?: string;   // blob URL for display (images)
  dataUrl?: string;      // base64 data URL (images, for multimodal LLM)
  textContent?: string;  // extracted text (docs + PDFs)
  isLoading: boolean;
  error?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib = await import("pdfjs-dist") as any;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as Array<{ str: string }>)
      .map((item) => item.str)
      .join(" ");
    textParts.push(pageText);
  }
  return textParts.join("\n\n").trim();
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const addFiles = useCallback(async (files: File[]) => {
    const newAtts: Attachment[] = files.map((file) => ({
      id: genId(),
      file,
      name: file.name,
      type: (IMAGE_TYPES.includes(file.type) ? "image" : "document") as "image" | "document",
      size: file.size,
      isLoading: true,
    }));

    setAttachments((prev) => [...prev, ...newAtts]);

    for (const att of newAtts) {
      if (att.size > MAX_FILE_SIZE) {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === att.id
              ? { ...a, isLoading: false, error: "文件过大（最大 10 MB）" }
              : a
          )
        );
        continue;
      }

      try {
        if (att.type === "image") {
          const dataUrl = await readAsDataURL(att.file);
          const previewUrl = URL.createObjectURL(att.file);
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === att.id ? { ...a, dataUrl, previewUrl, isLoading: false } : a
            )
          );
        } else if (
          att.file.type === "application/pdf" ||
          att.file.name.toLowerCase().endsWith(".pdf")
        ) {
          const textContent = await extractPdfText(att.file);
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === att.id ? { ...a, textContent, isLoading: false } : a
            )
          );
        } else {
          const textContent = await readAsText(att.file);
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === att.id ? { ...a, textContent, isLoading: false } : a
            )
          );
        }
      } catch {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === att.id ? { ...a, isLoading: false, error: "处理失败" } : a
          )
        );
      }
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
      return [];
    });
  }, []);

  /** Formats doc/text attachment content into an injectable context block */
  const buildTextContext = useCallback((): string => {
    const parts = attachments
      .filter((a) => a.textContent)
      .map((a) => `[附件: ${a.name}]\n${a.textContent!.slice(0, 8000)}`);
    if (!parts.length) return "";
    return `--- 附件内容 ---\n${parts.join("\n\n")}\n--- 附件内容结束 ---`;
  }, [attachments]);

  /** Returns base64 data URLs for image attachments (for multimodal LLM calls) */
  const getImageDataUrls = useCallback((): string[] => {
    return attachments
      .filter((a) => a.type === "image" && a.dataUrl && !a.error)
      .map((a) => a.dataUrl!);
  }, [attachments]);

  const hasLoading = attachments.some((a) => a.isLoading);

  return {
    attachments,
    hasLoading,
    addFiles,
    removeAttachment,
    clearAttachments,
    buildTextContext,
    getImageDataUrls,
  };
}
