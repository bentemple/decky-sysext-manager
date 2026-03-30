import { useState, useEffect, useCallback } from "react";
import {
  PanelSection,
  PanelSectionRow,
  ToggleField,
  ButtonItem,
  showModal,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { Extension, ExtensionConfig } from "../types/manifest";
import { ConfigRenderer } from "./ConfigRenderer";
import { UninstallDialog } from "./UninstallDialog";

interface ExtensionCardProps {
  extension: Extension;
  onEnable: (extId: string) => Promise<{ success: boolean; needs_reboot?: boolean; error?: string }>;
  onDisable: (extId: string, answers: Record<string, boolean>) => Promise<{ success: boolean; needs_reboot?: boolean; error?: string }>;
  onLoadConfig: (extId: string) => Promise<ExtensionConfig>;
  onSaveConfig: (extId: string, config: Record<string, string | number>) => Promise<{ success: boolean; error?: string }>;
  onReboot: () => Promise<{ success: boolean; error?: string }>;
}

export function ExtensionCard({
  extension,
  onEnable,
  onDisable,
  onLoadConfig,
  onSaveConfig,
  onReboot,
}: ExtensionCardProps) {
  const { manifest, enabled } = extension;
  const [configValues, setConfigValues] = useState<Record<string, string | number | boolean>>({});
  const [configLoaded, setConfigLoaded] = useState(false);
  const [pendingReboot, setPendingReboot] = useState(false);

  // Load config when extension becomes enabled
  useEffect(() => {
    if (enabled && manifest.config && !configLoaded) {
      onLoadConfig(manifest.id).then((config) => {
        if (!config.error && config.values) {
          setConfigValues(config.values);
          setConfigLoaded(true);
        }
      });
    }
  }, [enabled, manifest.config, manifest.id, configLoaded, onLoadConfig]);

  const handleToggle = useCallback(async (value: boolean) => {
    if (value) {
      // Enable extension
      const result = await onEnable(manifest.id);
      if (result.success) {
        if (result.needs_reboot) {
          setPendingReboot(true);
          toaster.toast({
            title: `${manifest.name} Enabled`,
            body: "Reboot required to activate",
          });
        }
      } else {
        toaster.toast({
          title: "Error",
          body: result.error || "Failed to enable extension",
        });
      }
    } else {
      // Disable extension
      if (manifest.uninstall?.prompts?.length) {
        // Show uninstall dialog
        showModal(
          <UninstallDialog
            extensionName={manifest.name}
            prompts={manifest.uninstall.prompts}
            onConfirm={async (answers) => {
              const result = await onDisable(manifest.id, answers);
              if (result.success) {
                setConfigLoaded(false);
                if (result.needs_reboot) {
                  setPendingReboot(true);
                  toaster.toast({
                    title: `${manifest.name} Disabled`,
                    body: "Reboot required to complete",
                  });
                }
              } else {
                toaster.toast({
                  title: "Error",
                  body: result.error || "Failed to disable extension",
                });
              }
            }}
            onCancel={() => {}}
          />
        );
      } else {
        // No prompts, disable directly
        const result = await onDisable(manifest.id, {});
        if (result.success) {
          setConfigLoaded(false);
          if (result.needs_reboot) {
            setPendingReboot(true);
            toaster.toast({
              title: `${manifest.name} Disabled`,
              body: "Reboot required to complete",
            });
          }
        } else {
          toaster.toast({
            title: "Error",
            body: result.error || "Failed to disable extension",
          });
        }
      }
    }
  }, [manifest, onEnable, onDisable]);

  const handleConfigChange = useCallback(
    async (id: string, value: string | number | boolean) => {
      const newValues = { ...configValues, [id]: value };
      setConfigValues(newValues);

      // Debounce and save - simplified: save on every change
      // In production, you'd want to debounce this
      const configToSave: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(newValues)) {
        if (typeof v === "boolean") {
          configToSave[k] = v ? "true" : "false";
        } else {
          configToSave[k] = v as string | number;
        }
      }

      const result = await onSaveConfig(manifest.id, configToSave);
      if (!result.success) {
        toaster.toast({
          title: "Config Error",
          body: result.error || "Failed to save configuration",
        });
      }
    },
    [configValues, manifest.id, onSaveConfig]
  );

  const handleReboot = useCallback(async () => {
    const result = await onReboot();
    if (!result.success) {
      toaster.toast({
        title: "Reboot Error",
        body: result.error || "Failed to trigger reboot",
      });
    }
  }, [onReboot]);

  return (
    <PanelSection title={manifest.name}>
      <PanelSectionRow>
        <ToggleField
          label={enabled ? "Enabled" : "Disabled"}
          description={manifest.description}
          checked={enabled}
          onChange={handleToggle}
          disabled={manifest.required}
        />
      </PanelSectionRow>

      {/* Show config when enabled and has config */}
      {enabled && manifest.config && configLoaded && (
        <ConfigRenderer
          parameters={manifest.config.parameters}
          values={configValues}
          onChange={handleConfigChange}
        />
      )}

      {/* Show reboot button when pending */}
      {pendingReboot && (
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleReboot}>
            Reboot Now
          </ButtonItem>
        </PanelSectionRow>
      )}
    </PanelSection>
  );
}
