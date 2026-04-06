import { toaster } from "@decky/api";

interface ToastParams {
  title: string;
  body?: string;
}

/**
 * Show a toast notification and log it for debugging.
 */
export function showToast({ title, body }: ToastParams): void {
  const message = body ? `${title}: ${body}` : title;
  console.log(`[Toast] ${message}`);
  toaster.toast({ title, body });
}
