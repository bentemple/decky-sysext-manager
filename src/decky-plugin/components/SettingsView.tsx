import { useState, useCallback, useRef } from "react";
import {
  SidebarNavigation,
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Focusable,
  showModal,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { FaChevronRight } from "react-icons/fa";
import { Extension, ExtensionStatus } from "../types/manifest";
import { useExtensions } from "../hooks/useExtensions";
import { ExtensionDetail } from "./ExtensionDetail";
import { UninstallDialog } from "./UninstallDialog";

// Status badge component
function StatusBadge({ status }: { status: ExtensionStatus }) {
  const colors: Record<ExtensionStatus, string> = {
    active: "#2ecc71",
    pending: "#f1c40f",
    disabled: "#95a5a6",
  };
  const labels: Record<ExtensionStatus, string> = {
    active: "Active",
    pending: "Pending",
    disabled: "Disabled",
  };

  return (
    <span
      style={{
        background: colors[status],
        color: status === "pending" ? "#000" : "#fff",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: "bold",
      }}
    >
      {labels[status]}
    </span>
  );
}

// Extension row in the list
function ExtensionRow({
  extension,
  onSelect,
}: {
  extension: Extension;
  onSelect: (ext: Extension) => void;
}) {
  const { manifest, status } = extension;
  const isLoader = manifest.id === "loader";

  return (
    <Focusable
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 0",
        cursor: "pointer",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}
      onActivate={() => handleSelectExtension(extension)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: isLoader ? "bold" : "normal" }}>
            {manifest.name}
          </span>
          {isLoader && (
            <span style={{ color: "#e74c3c", fontSize: 11 }}>Required</span>
          )}
        </div>
        <div
          style={{
            color: "#8b929a",
            fontSize: 12,
            marginTop: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {manifest.description}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: 12 }}>
        <StatusBadge status={status} />
        <FaChevronRight style={{ color: "#8b929a", fontSize: 12 }} />
      </div>
    </Focusable>
  );
}

// About page content
function AboutPage() {
  return (
    <>
      <PanelSection title="SteamOS Extensions">
        <PanelSectionRow>
          <div style={{ color: "#bdc3c7", fontSize: 14 }}>
            Manage SteamOS systemd-sysext extensions for power, performance, and utilities.
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Status Legend">
        <PanelSectionRow>
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
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Links">
        <PanelSectionRow>
          <div style={{ color: "#3498db", fontSize: 13 }}>
            github.com/bentemple/steamos-extensions
          </div>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}

// Category order for sorting
const CATEGORY_ORDER = ["system", "network", "power", "performance", "utilities", "boot", "other"];

function groupExtensionsByCategory(extensions: Extension[]): Record<string, Extension[]> {
  const categories: Record<string, Extension[]> = {};
  for (const ext of extensions) {
    if (ext.manifest.id === "loader") continue;
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

// Extension list page - shared between release and experimental tabs
function ExtensionListPage({
  extensions,
  loader,
  showLoader,
  onEnable,
  onDisable,
  onReboot,
}: {
  extensions: Extension[];
  loader: Extension | undefined;
  showLoader: boolean;
  onEnable: (extId: string) => Promise<{ success: boolean; needs_reboot?: boolean; error?: string }>;
  onDisable: (extId: string, answers: Record<string, boolean>) => Promise<{ success: boolean; needs_reboot?: boolean; error?: string }>;
  onReboot: () => Promise<{ success: boolean; error?: string }>;
}) {
  const [selectedExt, setSelectedExt] = useState<Extension | null>(null);
  const [pendingReboot, setPendingReboot] = useState(false);
  const scrollPositionRef = useRef<number>(0);

  const handleSelectExtension = useCallback((ext: Extension) => {
    scrollPositionRef.current = window.scrollY;
    setSelectedExt(ext);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedExt(null);
    setTimeout(() => {
      window.scrollTo(0, scrollPositionRef.current);
    }, 0);
  }, []);

  const loaderEnabled = loader?.status === "active" || loader?.status === "pending";

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

  return (
    <>
      {pendingReboot && (
        <PanelSection>
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={handleReboot}>
              Reboot Now to Apply Changes
            </ButtonItem>
          </PanelSectionRow>
        </PanelSection>
      )}

      {showLoader && loader && (
        <PanelSection title="Required">
          <ExtensionRow extension={loader} onSelect={setSelectedExt} />
        </PanelSection>
      )}

      {!loaderEnabled && (
        <PanelSection>
          <PanelSectionRow>
            <div style={{ color: "#e74c3c", fontSize: 13 }}>
              Enable Extension Loader first to use other extensions.
            </div>
          </PanelSectionRow>
        </PanelSection>
      )}

      {sortedCategories.map((category) => (
        <PanelSection
          key={category}
          title={category.charAt(0).toUpperCase() + category.slice(1)}
        >
          {categories[category].map((ext) => (
            <ExtensionRow
              key={ext.manifest.id}
              extension={ext}
              onSelect={setSelectedExt}
            />
          ))}
        </PanelSection>
      ))}

      {sortedCategories.length === 0 && !showLoader && (
        <PanelSection>
          <PanelSectionRow>
            <div style={{ color: "#8b929a", fontSize: 13 }}>
              No extensions in this category.
            </div>
          </PanelSectionRow>
        </PanelSection>
      )}
    </>
  );
}

// Main settings view with sidebar navigation
export function SettingsView() {
  const { extensions, enable, disable, triggerReboot } = useExtensions();

  // Find the loader (always shown in Extensions tab)
  const loader = extensions.find((e) => e.manifest.id === "loader");

  // Filter extensions by stability status (default to experimental)
  const releaseExtensions = extensions.filter(
    (e) => e.manifest.id !== "loader" && e.manifest.status === "release"
  );
  const experimentalExtensions = extensions.filter(
    (e) => e.manifest.id !== "loader" && e.manifest.status !== "release"
  );

  return (
    <SidebarNavigation
      title="SteamOS Extensions"
      showTitle={true}
      pages={[
        {
          title: "Extensions",
          content: (
            <ExtensionListPage
              extensions={releaseExtensions}
              loader={loader}
              showLoader={true}
              onEnable={enable}
              onDisable={disable}
              onReboot={triggerReboot}
            />
          ),
        },
        {
          title: "Experimental",
          content: (
            <ExtensionListPage
              extensions={experimentalExtensions}
              loader={loader}
              showLoader={false}
              onEnable={enable}
              onDisable={disable}
              onReboot={triggerReboot}
            />
          ),
        },
        {
          title: "About",
          content: <AboutPage />,
        },
      ]}
    />
  );
}
