import { useState, useEffect, useCallback } from "react";
import { callable } from "@decky/api";
import { Extension, ExtensionConfig } from "../types/manifest";

const getExtensions = callable<[], Extension[]>("get_extensions");
const enableExtension = callable<[ext_id: string], { success: boolean; needs_reboot?: boolean; error?: string }>("enable_extension");
const disableExtension = callable<[ext_id: string, prompt_answers: Record<string, boolean>], { success: boolean; needs_reboot?: boolean; error?: string }>("disable_extension");
const getConfig = callable<[ext_id: string], ExtensionConfig>("get_config");
const configureExtension = callable<[ext_id: string, config: Record<string, string | number>], { success: boolean; error?: string }>("configure_extension");
const runUpdateManager = callable<[ext_id: string, flag: string], { success: boolean; output: string; error?: string }>("run_update_manager");
const reboot = callable<[], { success: boolean; error?: string }>("reboot");

export function useExtensions() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const exts = await getExtensions();
      setExtensions(exts);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async (extId: string): Promise<{ success: boolean; needs_reboot?: boolean; error?: string }> => {
    const result = await enableExtension(extId);
    if (result.success) {
      await refresh();
    }
    return result;
  }, [refresh]);

  const disable = useCallback(async (extId: string, promptAnswers: Record<string, boolean> = {}): Promise<{ success: boolean; needs_reboot?: boolean; error?: string }> => {
    const result = await disableExtension(extId, promptAnswers);
    if (result.success) {
      await refresh();
    }
    return result;
  }, [refresh]);

  const loadConfig = useCallback(async (extId: string): Promise<ExtensionConfig> => {
    return await getConfig(extId);
  }, []);

  const saveConfig = useCallback(async (extId: string, config: Record<string, string | number>): Promise<{ success: boolean; error?: string }> => {
    return await configureExtension(extId, config);
  }, []);

  const updateManager = useCallback(async (extId: string, flag: string): Promise<{ success: boolean; output: string; error?: string }> => {
    return await runUpdateManager(extId, flag);
  }, []);

  const triggerReboot = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    return await reboot();
  }, []);

  return {
    extensions,
    loading,
    error,
    refresh,
    enable,
    disable,
    loadConfig,
    saveConfig,
    updateManager,
    triggerReboot,
  };
}
