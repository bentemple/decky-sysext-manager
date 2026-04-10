import { callable } from "@decky/api";

const logFromUI = callable<[level: string, message: string], { success: boolean }>("log_from_ui");

export interface Logger {
  info: (message: string) => Promise<void>;
}

export function createLogger(): Logger {
  return {
    info: async (message: string) => {
      try {
        await logFromUI("info", message);
      } catch (e) {
        console.error("Failed to log:", e);
      }
    },
  };
}
