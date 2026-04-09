import { useState, useCallback, useRef, useEffect } from "react";
import {
  SidebarNavigation,
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Focusable,
  showModal,
  ModalRoot,
} from "@decky/ui";
import { showToast } from "../utils/toast";
import { FaChevronRight, FaUpload } from "react-icons/fa";
import { Extension, ExtensionStatus } from "../types/manifest";
import { useExtensions } from "../hooks/useExtensions";
import { ExtensionDetail } from "./ExtensionDetail";
import { UninstallDialog } from "./UninstallDialog";
import { AboutPage } from "./AboutPage";

// Status badge component
function StatusBadge({ status }: { status: ExtensionStatus }) {
  const colors: Record<ExtensionStatus, string> = {
    active: "#2ecc71",
    pending: "#f1c40f",
    unloaded: "#e67e22",
    disabled: "#95a5a6",
  };
  const labels: Record<ExtensionStatus, string> = {
    active: "Active",
    pending: "Pending",
    unloaded: "Unloaded",
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
  showExperimentalTag,
  upstreamUpdateAvailable,
}: {
  extension: Extension;
  onSelect: (ext: Extension) => void;
  showExperimentalTag?: boolean;
  upstreamUpdateAvailable?: boolean;
}) {
  const { manifest, status } = extension;
  const isLoader = manifest.id === "loader";
  const isExperimental = manifest.release_status !== "release" && manifest.release_status !== "disabled" && manifest.id !== "loader";
  const hasUpdate = extension.bundled_update_available || upstreamUpdateAvailable;

  return (
    <Focusable
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 0",
        cursor: "pointer",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}
      onActivate={() => onSelect(extension)}
      onClick={() => onSelect(extension)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: isLoader ? "bold" : "normal" }}>
            {manifest.name}
          </span>
          {isLoader && (
            <span style={{ color: "#e74c3c", fontSize: 11 }}>Required</span>
          )}
          {showExperimentalTag && isExperimental && (
            <span style={{ color: "#f39c12", fontSize: 11 }}>Experimental</span>
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
        {hasUpdate && (
          <FaUpload style={{ color: "#f39c12", fontSize: 12 }} />
        )}
        <StatusBadge status={status} />
        <FaChevronRight style={{ color: "#8b929a", fontSize: 12 }} />
      </div>
    </Focusable>
  );
}

// Category order for sorting
const CATEGORY_ORDER = ["system", "power", "network", "utilities", "performance", "boot", "other"];

function groupExtensionsByCategory(extensions: Extension[]): Record<string, Extension[]> {
  const categories: Record<string, Extension[]> = {};
  for (const ext of extensions) {
    if (ext.manifest.id === "loader") continue;
    const cat = ext.manifest.category || "other";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(ext);
  }
  // Sort extensions alphabetically within each category
  for (const cat in categories) {
    categories[cat].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  }
  return categories;
}

function sortCategories(categories: string[]): string[] {
  return categories.sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  );
}

// Modal wrapper for ExtensionDetail - handles B button close naturally
function ExtensionDetailModal({
  extension,
  loaderEnabled,
  onToggle,
  onLoadConfig,
  onSaveConfig,
  onUpdateManager,
  onUpdateExt,
  onEnableSysext,
  onUpdateComplete,
  onRefresh,
  closeModal,
}: {
  extension: Extension;
  loaderEnabled: boolean;
  onToggle: (ext: Extension, enabled: boolean) => Promise<void>;
  onLoadConfig: (extId: string) => Promise<import("../types/manifest").ExtensionConfig>;
  onSaveConfig: (extId: string, config: Record<string, string | number>) => Promise<{ success: boolean; error?: string }>;
  onUpdateManager: (extId: string, flag: string) => Promise<{ success: boolean; output: string; error?: string }>;
  onUpdateExt: (extId: string) => Promise<{ success: boolean; needs_reboot?: boolean; error?: string }>;
  onEnableSysext: () => Promise<{ success: boolean; error?: string }>;
  onUpdateComplete?: (extId: string) => void;
  onRefresh: () => Promise<Extension | undefined>;
  closeModal?: () => void;
}) {
  const handleBack = () => {
    closeModal?.();
  };

  return (
    <ModalRoot
      onCancel={handleBack}
      closeModal={handleBack}
      bAllowFullSize={true}
    >
      <ExtensionDetail
        extension={extension}
        loaderEnabled={loaderEnabled}
        onBack={handleBack}
        onToggle={onToggle}
        onLoadConfig={onLoadConfig}
        onSaveConfig={onSaveConfig}
        onUpdateManager={onUpdateManager}
        onUpdateExt={onUpdateExt}
        onEnableSysext={onEnableSysext}
        onUpdateComplete={onUpdateComplete}
        onRefresh={onRefresh}
      />
    </ModalRoot>
  );
}

// Extension list page - shared between tabs
function ExtensionListPage({
  extensions,
  loading,
  enable,
  disable,
  updateExt,
  triggerReboot,
  loadConfig,
  saveConfig,
  updateManager,
  enableSysext,
  refreshAndGetExtension,
  filterFn,
  showLoader,
  showExperimentalTags,
  emptyMessage,
}: {
  extensions: Extension[];
  loading: boolean;
  enable: (extId: string) => Promise<{ success: boolean; needs_reboot?: boolean; error?: string }>;
  disable: (extId: string, promptAnswers?: Record<string, boolean>) => Promise<{ success: boolean; needs_reboot?: boolean; error?: string }>;
  updateExt: (extId: string) => Promise<{ success: boolean; needs_reboot?: boolean; error?: string }>;
  triggerReboot: () => Promise<{ success: boolean; error?: string }>;
  loadConfig: (extId: string) => Promise<import("../types/manifest").ExtensionConfig>;
  saveConfig: (extId: string, config: Record<string, string | number>) => Promise<{ success: boolean; error?: string }>;
  updateManager: (extId: string, flag: string) => Promise<{ success: boolean; output: string; error?: string }>;
  enableSysext: () => Promise<{ success: boolean; error?: string }>;
  refreshAndGetExtension: (extId: string) => Promise<Extension | undefined>;
  filterFn: (e: Extension) => boolean;
  showLoader: boolean;
  showExperimentalTags?: boolean;
  emptyMessage?: string;
}) {
  const loader = extensions.find((e) => e.manifest.id === "loader");

  const [pendingReboot, setPendingReboot] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Track upstream update state per extension
  const [upstreamUpdates, setUpstreamUpdates] = useState<Record<string, boolean>>({});

  // Check for upstream updates for extensions with update_manager
  useEffect(() => {
    const extensionsToCheck = extensions.filter(
      (e) => e.has_update_manager && (e.status === "active" || e.status === "pending") && !(e.manifest.id in upstreamUpdates)
    );

    for (const ext of extensionsToCheck) {
      Promise.all([
        updateManager(ext.manifest.id, "--get-current-version"),
        updateManager(ext.manifest.id, "--get-latest-version"),
      ]).then(([cur, lat]) => {
        const current = cur.output?.trim() || "";
        const latest = lat.output?.trim() || "";
        const available = !!latest && !!current && current !== latest;
        setUpstreamUpdates((prev) => ({ ...prev, [ext.manifest.id]: available }));
      }).catch(() => {
        setUpstreamUpdates((prev) => ({ ...prev, [ext.manifest.id]: false }));
      });
    }
  }, [extensions, updateManager]);

  // Stable membership: snapshot grows when new matching extensions appear, never shrinks.
  // IDs are added on first match; removed only when component unmounts (tab switch).
  const snapshotIdsRef = useRef<Set<string>>(new Set());
  const matchingIds = extensions.filter(filterFn).map((e) => e.manifest.id);
  for (const id of matchingIds) {
    snapshotIdsRef.current.add(id);
  }

  // Resolve snapshot IDs against live extensions for up-to-date status/badges
  const byId = new Map(extensions.map((e) => [e.manifest.id, e]));
  const stableExtensions = Array.from(snapshotIdsRef.current).flatMap((id) => {
    const ext = byId.get(id);
    return ext ? [ext] : [];
  });


  // Loader is "enabled" if .raw file exists (active, pending, or unloaded)
  const loaderEnabled = loader?.status === "active" || loader?.status === "pending" || loader?.status === "unloaded";
  const categories = groupExtensionsByCategory(stableExtensions);
  const sortedCategories = sortCategories(Object.keys(categories));

  const handleToggle = useCallback(
    async (ext: Extension, doEnable: boolean) => {
      if (doEnable) {
        const result = await enable(ext.manifest.id);
        if (result.success) {
          if (result.needs_reboot) {
            setPendingReboot(true);
            showToast({
              title: `${ext.manifest.name} Enabled`,
              body: "Reboot required to activate",
            });
          }
        } else {
          showToast({ title: "Error", body: result.error || "Failed to enable" });
        }
      } else {
        if (ext.manifest.uninstall?.prompts?.length) {
          const { closeModal } = showModal(
            <UninstallDialog
              extensionName={ext.manifest.name}
              prompts={ext.manifest.uninstall.prompts}
              onConfirm={async (answers) => {
                const result = await disable(ext.manifest.id, answers);
                if (result.success && result.needs_reboot) {
                  setPendingReboot(true);
                  showToast({
                    title: `${ext.manifest.name} Disabled`,
                    body: "Reboot required",
                  });
                }
                closeModal();
              }}
              onCancel={() => {
                closeModal();
              }}
            />
          );
        } else {
          const result = await disable(ext.manifest.id, {});
          if (result.success && result.needs_reboot) {
            setPendingReboot(true);
            showToast({
              title: `${ext.manifest.name} Disabled`,
              body: "Reboot required",
            });
          }
        }
      }
    },
    [enable, disable]
  );

  // Callback to clear upstream update state after an update completes
  const handleUpdateComplete = useCallback((extId: string) => {
    // Remove from cache so it gets re-checked
    setUpstreamUpdates((prev) => {
      const next = { ...prev };
      delete next[extId];
      return next;
    });
  }, []);

  const handleSelectExtension = useCallback((ext: Extension) => {
    // Get the live extension data
    const liveExt = byId.get(ext.manifest.id) ?? ext;
    const isLoaderEnabled = loader?.status === "active" || loader?.status === "pending" || loader?.status === "unloaded";
    const extId = ext.manifest.id;

    // Use showModal to display detail - B button will naturally close the modal
    showModal(
      <ExtensionDetailModal
        extension={liveExt}
        loaderEnabled={isLoaderEnabled}
        onToggle={handleToggle}
        onLoadConfig={loadConfig}
        onSaveConfig={saveConfig}
        onUpdateManager={updateManager}
        onUpdateExt={updateExt}
        onEnableSysext={enableSysext}
        onUpdateComplete={handleUpdateComplete}
        onRefresh={() => refreshAndGetExtension(extId)}
      />
    );
  }, [byId, loader, handleToggle, loadConfig, saveConfig, updateManager, updateExt, enableSysext, handleUpdateComplete, refreshAndGetExtension]);

  const handleReboot = useCallback(async () => {
    await triggerReboot();
  }, [triggerReboot]);

  return (
    <div ref={rootRef}>
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
          <ExtensionRow
            extension={loader}
            onSelect={handleSelectExtension}
            upstreamUpdateAvailable={upstreamUpdates[loader.manifest.id]}
          />
        </PanelSection>
      )}

      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div
            style={{
              width: 24,
              height: 24,
              border: "3px solid rgba(255,255,255,0.1)",
              borderTopColor: "#1a9fff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && !loaderEnabled && !showLoader && (
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
              onSelect={handleSelectExtension}
              showExperimentalTag={showExperimentalTags}
              upstreamUpdateAvailable={upstreamUpdates[ext.manifest.id]}
            />
          ))}
        </PanelSection>
      ))}

      {sortedCategories.length === 0 && !showLoader && !loading && (
        <PanelSection>
          <PanelSectionRow>
            <div style={{ color: "#8b929a", fontSize: 13 }}>
              {emptyMessage || "No extensions in this category."}
            </div>
          </PanelSectionRow>
        </PanelSection>
      )}
    </div>
  );
}

// Main settings view with sidebar navigation
export function SettingsView() {
  const { extensions, loading, enable, disable, updateExt, triggerReboot, loadConfig, saveConfig, updateManager, enableSysextService, refreshAndGetExtension } = useExtensions();

  const sharedProps = {
    extensions,
    loading,
    enable,
    disable,
    updateExt,
    triggerReboot,
    loadConfig,
    saveConfig,
    updateManager,
    enableSysext: enableSysextService,
    refreshAndGetExtension,
  };

  return (
    <SidebarNavigation
      title="Sysext Manager"
      showTitle={true}
      pages={[
        {
          title: "Enabled",
          hideTitle: true,
          content: (
            <ExtensionListPage
              {...sharedProps}
              key="enabled"
              filterFn={(e) => e.manifest.id !== "loader" && e.manifest.release_status !== "disabled" && (e.status === "active" || e.status === "pending" || e.status === "unloaded")}
              showLoader={true}
              showExperimentalTags={true}
              emptyMessage="No extensions enabled."
            />
          ),
        },
        {
          title: "Available",
          hideTitle: true,
          content: (
            <ExtensionListPage
              {...sharedProps}
              key="available"
              filterFn={(e) => e.manifest.release_status === "release"}
              showLoader={true}
              showExperimentalTags={true}
              emptyMessage="All release extensions are already enabled."
            />
          ),
        },
        {
          title: "Experimental",
          hideTitle: true,
          content: (
            <ExtensionListPage
              {...sharedProps}
              key="experimental"
              filterFn={(e) => e.manifest.id !== "loader" && e.manifest.release_status !== "release" && e.manifest.release_status !== "disabled"}
              showLoader={false}
              showExperimentalTags={true}
              emptyMessage="No experimental extensions available."
            />
          ),
        },
        {
          title: "About",
          hideTitle: true,
          content: (
            <AboutPage
              extensions={extensions}
              disable={disable}
              triggerReboot={triggerReboot}
            />
          ),
        },
      ]}
    />
  );
}
