/** "512 B", "1.5 KB", "2.0 MB" */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export type StatusTone = "ok" | "redirect" | "client" | "error";

/** 2xx ok · 3xx redirect · 4xx client (warn) · 429 and 5xx error. */
export function statusTone(status: number): StatusTone {
  if (status === 429 || status >= 500) return "error";
  if (status >= 400) return "client";
  if (status >= 300) return "redirect";
  if (status >= 200) return "ok";
  return "redirect";
}
