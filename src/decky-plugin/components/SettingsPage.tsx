import { useState, useCallback } from "react";
import { PanelSection, PanelSectionRow, ButtonItem, showModal } from "@decky/ui";
import { toaster } from "@decky/api";
import { Extension } from "../types/manifest";
import { ExtensionRow } from "./ExtensionRow";
import { ExtensionDetail } from "./ExtensionDetail";
import { UninstallDialog } from "./UninstallDialog";

interface SettingsPageProps {
  extensions: Extension[];
  onEnable: (extId: string) => Promise<{ success: boolean; needs_reboot?: boolean; error?: string }>;
  onDisable: (extId: string, answers: Record<string, boolean>) => Promise<{ success: boolean; needs_reboot?: boolean; error?: string }>;
  onReboot: () => Promise<{ success: boolean; error?: string }>;
}

const CATEGORY_ORDER = ["system", "network", "power", "performance", "utilities", "boot", "other"];

function groupExtensionsByCategory(extensions: Extension[]): Record<string, Extension[]> {
  const categories: Record<string, Extension[]> = {};
  for (const ext of extensions) {
    if (ext.manifest.id === "loader") continue; // Loader shown separately
    const cat = ext.manifest.category || "other";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(ext);
  }
  return categories;
}

function sortCategories(categories: string[]): string[] {
  return categories.sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  );
}

export function SettingsPage({ extensions, onEnable, onDisable, onReboot }: SettingsPageProps) {
  const [selectedExt, setSelectedExt] = useState<Extension | null>(null);
  const [pendingReboot, setPendingReboot] = useState(false);

  // Find loader and check if it's enabled
  const loader = extensions.find((e) => e.manifest.id === "loader");
  const loaderEnabled = loader?.status === "active" || loader?.status === "pending";

  // Group by category
  const categories = groupExtensionsByCategory(extensions);
  const sortedCategories = sortCategories(Object.keys(categories));

  const handleToggle = useCallback(
    async (ext: Extension, enable: boolean) => {
      if (enable) {
        const result = await onEnable(ext.manifest.id);
        if (result.success) {
          if (result.needs_reboot) {
            setPendingReboot(true);
            toaster.toast({
              title: `${ext.manifest.name} Enabled`,
              body: "Reboot required to activate",
            });
          }
        } else {
          toaster.toast({ title: "Error", body: result.error || "Failed to enable" });
        }
      } else {
        if (ext.manifest.uninstall?.prompts?.length) {
          showModal(
            <UninstallDialog
              extensionName={ext.manifest.name}
              prompts={ext.manifest.uninstall.prompts}
              onConfirm={async (answers) => {
                const result = await onDisable(ext.manifest.id, answers);
                if (result.success && result.needs_reboot) {
                  setPendingReboot(true);
                  toaster.toast({
                    title: `${ext.manifest.name} Disabled`,
                    body: "Reboot required",
                  });
                }
              }}
              onCancel={() => {}}
            />
          );
        } else {
          const result = await onDisable(ext.manifest.id, {});
          if (result.success && result.needs_reboot) {
            setPendingReboot(true);
            toaster.toast({
              title: `${ext.manifest.name} Disabled`,
              body: "Reboot required",
            });
          }
        }
      }
    },
    [onEnable, onDisable]
  );

  const handleReboot = useCallback(async () => {
    await onReboot();
  }, [onReboot]);

  // Detail view
  if (selectedExt) {
    return (
      <ExtensionDetail
        extension={selectedExt}
        loaderEnabled={loaderEnabled}
        onBack={() => setSelectedExt(null)}
        onToggle={handleToggle}
      />
    );
  }

  // List view
  return (
    <>
      {/* Reboot banner */}
      {pendingReboot && (
        <PanelSection>
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={handleReboot}>
              Reboot Now to Apply Changes
            </ButtonItem>
          </PanelSectionRow>
        </PanelSection>
      )}

      {/* Loader - always at top */}
      {loader && (
        <PanelSection title="Required">
          <ExtensionRow
            extension={loader}
            loaderEnabled={true}
            onToggle={handleToggle}
            onSelect={setSelectedExt}
          />
        </PanelSection>
      )}

      {/* Warning if loader not enabled */}
      {!loaderEnabled && (
        <PanelSection>
          <PanelSectionRow>
            <div style={{ color: "#e74c3c", fontSize: 13 }}>
              Enable Extension Loader first to use other extensions.
            </div>
          </PanelSectionRow>
        </PanelSection>
      )}

      {/* Extensions by category */}
      {sortedCategories.map((category) => (
        <PanelSection
          key={category}
          title={category.charAt(0).toUpperCase() + category.slice(1)}
        >
          {categories[category].map((ext) => (
            <ExtensionRow
              key={ext.manifest.id}
              extension={ext}
              loaderEnabled={loaderEnabled}
              onToggle={handleToggle}
              onSelect={setSelectedExt}
            />
          ))}
        </PanelSection>
      ))}
    </>
  );
}
