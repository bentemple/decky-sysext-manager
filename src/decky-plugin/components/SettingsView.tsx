import { useState, useCallback, useRef, useEffect } from "react";
import {
  SidebarNavigation,
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Focusable,
  showModal,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { FaChevronRight, FaUpload } from "react-icons/fa";
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
  showExperimentalTag,
}: {
  extension: Extension;
  onSelect: (ext: Extension) => void;
  showExperimentalTag?: boolean;
}) {
  const { manifest, status } = extension;
  const isLoader = manifest.id === "loader";
  const isExperimental = manifest.release_status !== "release" && manifest.release_status !== "disabled" && manifest.id !== "loader";

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
        {extension.bundled_update_available && (
          <FaUpload style={{ color: "#f39c12", fontSize: 12 }} />
        )}
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

// Walk up the DOM to find the first scrollable ancestor
function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
  while (el && el !== document.body) {
    const { overflowY } = window.getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll") return el;
    el = el.parentElement;
  }
  return null;
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
  filterFn: (e: Extension) => boolean;
  showLoader: boolean;
  showExperimentalTags?: boolean;
  emptyMessage?: string;
}) {
  const loader = extensions.find((e) => e.manifest.id === "loader");

  const [selectedExt, setSelectedExt] = useState<Extension | null>(null);
  const [pendingReboot, setPendingReboot] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const savedScrollTop = useRef<number>(0);

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

  // Discover the scroll container once we have a DOM element to walk up from
  useEffect(() => {
    if (rootRef.current && !scrollContainerRef.current) {
      scrollContainerRef.current = findScrollContainer(rootRef.current);
    }
  });

  const loaderEnabled = loader?.status === "active" || loader?.status === "pending";
  const categories = groupExtensionsByCategory(stableExtensions);
  const sortedCategories = sortCategories(Object.keys(categories));

  // Keep selectedExt live
  const liveSelectedExt = selectedExt ? (byId.get(selectedExt.manifest.id) ?? selectedExt) : null;

  const handleSelectExtension = useCallback((ext: Extension) => {
    savedScrollTop.current = scrollContainerRef.current?.scrollTop ?? 0;
    setSelectedExt(ext);
    // Scroll to top for the detail view
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    });
  }, []);

  const handleBack = useCallback(() => {
    setSelectedExt(null);
    // Restore list scroll position after React re-renders
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = savedScrollTop.current;
      }
    });
  }, []);

  const handleToggle = useCallback(
    async (ext: Extension, doEnable: boolean) => {
      if (doEnable) {
        const result = await enable(ext.manifest.id);
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
                const result = await disable(ext.manifest.id, answers);
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
          const result = await disable(ext.manifest.id, {});
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
    [enable, disable]
  );

  const handleReboot = useCallback(async () => {
    await triggerReboot();
  }, [triggerReboot]);

  if (liveSelectedExt) {
    return (
      <ExtensionDetail
        extension={liveSelectedExt}
        loaderEnabled={loaderEnabled}
        onBack={handleBack}
        onToggle={handleToggle}
        onLoadConfig={loadConfig}
        onSaveConfig={saveConfig}
        onUpdateManager={updateManager}
        onUpdateExt={updateExt}
      />
    );
  }

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
          <ExtensionRow extension={loader} onSelect={handleSelectExtension} />
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
  const { extensions, loading, enable, disable, updateExt, triggerReboot, loadConfig, saveConfig, updateManager } = useExtensions();

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
  };

  return (
    <SidebarNavigation
      title="SteamOS Extensions"
      showTitle={true}
      pages={[
        {
          title: "Enabled",
          hideTitle: true,
          content: (
            <ExtensionListPage
              {...sharedProps}
              key="enabled"
              filterFn={(e) => e.manifest.id !== "loader" && e.manifest.release_status !== "disabled" && (e.status === "active" || e.status === "pending")}
              showLoader={true}
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
              showLoader={false}
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
          content: <AboutPage />,
        },
      ]}
    />
  );
}
