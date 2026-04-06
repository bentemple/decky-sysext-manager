import { useCallback } from "react";
import {
  DialogBody,
  DialogControlsSection,
  Field,
  Focusable,
  ButtonItem,
  showModal,
  ConfirmModal,
} from "@decky/ui";

declare const SteamClient: {
  URL: {
    ExecuteSteamURL: (url: string) => void;
  };
};
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
          const loader = extensions.find((e) => e.manifest.id === "loader");
          const others = extensions.filter(
            (e) => e.manifest.id !== "loader" && e.status !== "disabled"
          );

          const uninstallOne = async (ext: Extension): Promise<void> => {
            return new Promise((resolve) => {
              if (ext.manifest.uninstall?.prompts?.length) {
                showModal(
                  <UninstallDialog
                    extensionName={ext.manifest.name}
                    prompts={ext.manifest.uninstall.prompts}
                    onConfirm={async (answers) => {
                      await disable(ext.manifest.id, answers);
                      resolve();
                    }}
                    onCancel={() => resolve()}
                  />
                );
              } else {
                disable(ext.manifest.id, {}).then(() => resolve());
              }
            });
          };

          for (const ext of others) {
            await uninstallOne(ext);
          }

          if (loader && loader.status !== "disabled") {
            await uninstallOne(loader);
          }

          await triggerReboot();
        }}
        onCancel={() => {}}
      />
    );
  }, [extensions, disable, triggerReboot]);

  return (
    <DialogBody>
      <DialogControlsSection>
        {/* About Section */}
        <Focusable
          // @ts-ignore
          focusableIfNoChildren={true}
        >
          <span style={{ fontSize: "1.2em" }}>About SteamOS Sysext Extensions</span>
          <div style={{ width: "100%", height: "1px", background: "linear-gradient(to right, #00ccff, #3366ff)", marginTop: 4 }} />
        </Focusable>
        <Field
          focusable={true}
          description="SteamOS Sysext Extensions are system modifications that persist across SteamOS updates using systemd-sysext. They enable power management tweaks, VPN access, performance tuning, and other utilities without directly modifying the read-only root filesystem."
        />

        {/* How systemd-sysext Works Section */}
        <Focusable
          // @ts-ignore
          focusableIfNoChildren={true}
          style={{ marginTop: 16 }}
        >
          <span style={{ fontSize: "1.2em" }}>How systemd-sysext Works</span>
          <div style={{ width: "100%", height: "1px", background: "linear-gradient(to right, #00ccff, #3366ff)", marginTop: 4 }} />
        </Focusable>
        <Field
          focusable={true}
          label="SteamOS: An Immutable OS"
          description="SteamOS uses a read-only root filesystem that gets replaced entirely during updates. This helps to reduce update size, and ensures that any SteamOS version is running a consistent environment. However, because of this, traditional modifications to the system's /usr or /etc directories can be lost with each update."
        />
        <Field
          focusable={true}
          label="systemd-sysext: OverlayFS"
          description="Systemd-sysext provides a method for layering extension content on top of the base system without modifying it. It does this by mounting a squashfs filesystem image on-top of the existing OS's filesystem. Files from extensions shadow or add to the base system in /usr (like /usr/bin/, /usr/lib/, /usr/share/)."
        />
        <Field
          focusable={true}
          label="Update Survival"
          description="Extensions live in /var/lib/extensions/ (which is on the writable home partition) and re-merge with the system after SteamOS updates. The loader extension uses an atomic-update.conf file to mark it and other config files for persistence across updates, and then the loader in-turn re-enables systemd-sysext and the installed extensions."
        />

        {/* Status Legend Section */}
        <Focusable
          // @ts-ignore
          focusableIfNoChildren={true}
          style={{ marginTop: 16 }}
        >
          <span style={{ fontSize: "1.2em" }}>Status Legend</span>
          <div style={{ width: "100%", height: "1px", background: "linear-gradient(to right, #00ccff, #3366ff)", marginTop: 4 }} />
        </Focusable>
        <Field
          focusable={true}
          description={
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div><span style={{ color: "#27ae60" }}>●</span> Active - Extension is loaded and running</div>
              <div><span style={{ color: "#f39c12" }}>●</span> Pending - Reboot required to activate</div>
              <div><span style={{ color: "#e67e22" }}>●</span> Unloaded - systemd-sysext not running</div>
              <div><span style={{ color: "#7f8c8d" }}>●</span> Disabled - Extension is not enabled</div>
            </div>
          }
        />

        {/* Links Section */}
        <Focusable
          // @ts-ignore
          focusableIfNoChildren={true}
          style={{ marginTop: 16 }}
        >
          <span style={{ fontSize: "1.2em" }}>Links</span>
          <div style={{ width: "100%", height: "1px", background: "linear-gradient(to right, #00ccff, #3366ff)", marginTop: 4 }} />
        </Focusable>
        <Field
          focusable={true}
          label="GitHub"
          description="github.com/bentemple/decky-sysext-manager"
          onClick={() => SteamClient.URL.ExecuteSteamURL("steam://openurl/https://github.com/bentemple/decky-sysext-manager")}
        />

        {/* Manage Section */}
        <Focusable
          // @ts-ignore
          focusableIfNoChildren={true}
          style={{ marginTop: 16 }}
        >
          <span style={{ fontSize: "1.2em" }}>Manage</span>
          <div style={{ width: "100%", height: "1px", background: "linear-gradient(to right, #00ccff, #3366ff)", marginTop: 4 }} />
        </Focusable>
        <ButtonItem
          layout="below"
          onClick={handleUninstallAll}
        >
          Uninstall All Extensions
        </ButtonItem>
      </DialogControlsSection>
    </DialogBody>
  );
}
