import { useCallback } from "react";
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Focusable,
  showModal,
  ConfirmModal,
} from "@decky/ui";
import { Extension } from "../types/manifest";
import { UninstallDialog } from "./UninstallDialog";

interface AboutPageProps {
  extensions: Extension[];
  disable: (extId: string, promptAnswers?: Record<string, boolean>) => Promise<{ success: boolean; needs_reboot?: boolean; error?: string }>;
  triggerReboot: () => Promise<{ success: boolean; error?: string }>;
}

export function AboutPage({ extensions, disable, triggerReboot }: AboutPageProps) {
  const handleUninstallAll = useCallback(async () => {
    showModal(
      <ConfirmModal
        strTitle="Uninstall All Extensions"
        strDescription="This will uninstall all extensions and reboot your Steam Deck. Are you sure?"
        strOKButtonText="Uninstall All & Reboot"
        strCancelButtonText="Cancel"
        onOK={async () => {
          // Separate loader from other extensions
          const loader = extensions.find((e) => e.manifest.id === "loader");
          const others = extensions.filter(
            (e) => e.manifest.id !== "loader" && e.status !== "disabled"
          );

          // Helper to uninstall one extension (with prompts if needed)
          const uninstallOne = async (ext: Extension): Promise<void> => {
            return new Promise((resolve) => {
              if (ext.manifest.uninstall?.prompts?.length) {
                // Show prompts for this extension
                showModal(
                  <UninstallDialog
                    extensionName={ext.manifest.name}
                    prompts={ext.manifest.uninstall.prompts}
                    onConfirm={async (answers) => {
                      await disable(ext.manifest.id, answers);
                      resolve();
                    }}
                    onCancel={() => {
                      // User cancelled - skip this extension
                      resolve();
                    }}
                  />
                );
              } else {
                // No prompts - just disable
                disable(ext.manifest.id, {}).then(() => resolve());
              }
            });
          };

          // Uninstall all non-loader extensions first (sequentially to show prompts)
          for (const ext of others) {
            await uninstallOne(ext);
          }

          // Uninstall loader last (if enabled)
          if (loader && loader.status !== "disabled") {
            await uninstallOne(loader);
          }

          // Reboot
          await triggerReboot();
        }}
        onCancel={() => {}}
      />
    );
  }, [extensions, disable, triggerReboot]);

  return (
    <>
      <PanelSection title="About SteamOS Extensions">
        <PanelSectionRow>
          <Focusable style={{ outline: "none" }}>
            <div style={{ color: "#bdc3c7", fontSize: 14, lineHeight: 1.5 }}>
              SteamOS Extensions are system modifications that persist across SteamOS updates using systemd-sysext.
              They enable power management tweaks, VPN access, performance tuning, and other utilities without
              modifying the read-only root filesystem.
            </div>
          </Focusable>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="How systemd-sysext Works">
        <PanelSectionRow>
          <Focusable style={{ outline: "none" }}>
            <div style={{ color: "#bdc3c7", fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#ecf0f1" }}>Immutable OS Challenge:</strong> SteamOS uses a read-only
                root filesystem that gets replaced entirely during updates. Traditional modifications would be lost.
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#ecf0f1" }}>OverlayFS Solution:</strong> systemd-sysext uses overlay
                filesystems to layer extension content on top of the base system without modifying it. Extensions
                appear as if they're part of /usr, but the base OS remains untouched.
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#ecf0f1" }}>How Merging Works:</strong> When systemd-sysext activates
                extensions, it creates an overlay mount where the lower layer is the read-only /usr, and upper
                layers are the extension .raw images. Files from extensions shadow or add to the base system.
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#ecf0f1" }}>Extension Images:</strong> Each .raw file is a squashfs
                image containing a directory structure that mirrors /usr (like /usr/bin/, /usr/lib/, /usr/share/).
                These merge seamlessly into the system hierarchy.
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#ecf0f1" }}>Update Survival:</strong> Extensions live in /var/lib/extensions/,
                which is on the writable home partition. After a SteamOS update replaces the root filesystem, the
                extensions are still there and re-merge with the new base system.
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#ecf0f1" }}>Activation Modes:</strong> Extensions can activate on boot
                (merged before system starts), automatically via systemd units (on-demand), or via hot-reload
                (systemd-sysext refresh without reboot).
              </div>
              <div>
                <strong style={{ color: "#ecf0f1" }}>Extension Loader:</strong> This special extension runs after
                SteamOS updates to reinstall other extensions from their bundled sources, ensuring your customizations
                persist even when the base system is replaced.
              </div>
            </div>
          </Focusable>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Status Legend">
        <PanelSectionRow>
          <Focusable style={{ outline: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <span style={{ color: "#27ae60" }}>●</span> Active - Extension is loaded and running
              </div>
              <div>
                <span style={{ color: "#f39c12" }}>●</span> Pending - Reboot required to activate
              </div>
              <div>
                <span style={{ color: "#7f8c8d" }}>●</span> Disabled - Extension is not enabled
              </div>
            </div>
          </Focusable>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Links">
        <PanelSectionRow>
          <Focusable style={{ outline: "none" }}>
            <div style={{ color: "#3498db", fontSize: 13 }}>
              github.com/bentemple/steamos-extensions
            </div>
          </Focusable>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Other">
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={handleUninstallAll}
          >
            Uninstall All Extensions
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}
