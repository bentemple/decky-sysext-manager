import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Spinner,
  Navigation,
} from "@decky/ui";
import { FaCog, FaCheck, FaClock, FaTimes, FaUpload } from "react-icons/fa";
import { useEffect, useState } from "react";
import { Extension, ExtensionStatus } from "../types/manifest";

// Status icon component - shows update icon when update is available
function StatusIcon({ status, updateAvailable, checkingUpdate }: {
  status: ExtensionStatus;
  updateAvailable?: boolean;
  checkingUpdate?: boolean;
}) {
  if (status === "active" || status === "pending") {
    if (checkingUpdate) {
      return <Spinner style={{ width: 14, height: 14, marginRight: 8 }} />;
    }
    if (updateAvailable) {
      return <FaUpload style={{ color: "#f39c12", marginRight: 8 }} />;
    }
  }
  switch (status) {
    case "active":
      return <FaCheck style={{ color: "#2ecc71", marginRight: 8 }} />;
    case "pending":
      return <FaClock style={{ color: "#f1c40f", marginRight: 8 }} />;
    case "unloaded":
      return <FaClock style={{ color: "#e67e22", marginRight: 8 }} />;
    default:
      return <FaTimes style={{ color: "#95a5a6", marginRight: 8 }} />;
  }
}

interface QuickAccessPanelProps {
  extensions: Extension[];
  loading: boolean;
  error: string | null;
  updateManager: (extId: string, flag: string) => Promise<{ success: boolean; output: string; error?: string }>;
  sysextStatus: { active: boolean; status: string };
  onEnableSysext: () => Promise<{ success: boolean; error?: string }>;
}

export function QuickAccessPanel({ extensions, loading, error, updateManager, sysextStatus, onEnableSysext }: QuickAccessPanelProps) {
  // Track update state per extension: undefined=not checked, true=available, false=up to date
  const [updateStates, setUpdateStates] = useState<Record<string, { checking: boolean; available: boolean }>>({});

  const enabledWithUpdateManager = extensions.filter(
    (e) => e.manifest.id !== "loader" && (e.status === "active" || e.status === "pending") && e.has_update_manager
  );

  // Check for updates for all enabled extensions that have an update-manager
  // Only check extensions that haven't been checked yet to avoid unnecessary re-checks
  useEffect(() => {
    if (enabledWithUpdateManager.length === 0) return;

    // Only check extensions that haven't been checked yet
    const extensionsToCheck = enabledWithUpdateManager.filter(
      (ext) => !updateStates[ext.manifest.id]
    );

    if (extensionsToCheck.length === 0) return;

    // Mark all as checking
    setUpdateStates((prev) => {
      const next = { ...prev };
      for (const ext of extensionsToCheck) {
        next[ext.manifest.id] = { checking: true, available: false };
      }
      return next;
    });

    // Fetch current + latest version for each in parallel
    for (const ext of extensionsToCheck) {
      Promise.all([
        updateManager(ext.manifest.id, "--get-current-version"),
        updateManager(ext.manifest.id, "--get-latest-version"),
      ]).then(([cur, lat]) => {
        const current = cur.output?.trim() || "";
        const latest = lat.output?.trim() || "";
        const available = !!latest && !!current && current !== latest;
        setUpdateStates((prev) => ({
          ...prev,
          [ext.manifest.id]: { checking: false, available },
        }));
      }).catch(() => {
        setUpdateStates((prev) => ({
          ...prev,
          [ext.manifest.id]: { checking: false, available: false },
        }));
      });
    }
  }, [extensions]);

  if (loading) {
    return (
      <PanelSection>
        <PanelSectionRow>
          <Spinner />
        </PanelSectionRow>
      </PanelSection>
    );
  }

  if (error) {
    return (
      <PanelSection>
        <PanelSectionRow>
          <div style={{ color: "#e74c3c" }}>{error}</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  const loader = extensions.find((e) => e.manifest.id === "loader");
  const loaderActive = loader?.status === "active";

  // Show extensions that are installed (.raw file exists) - includes active, pending, and unloaded
  const enabledExtensions = extensions
    .filter((e) => e.manifest.id !== "loader" && (e.status === "active" || e.status === "pending" || e.status === "unloaded"))
    .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));

  const getLoaderStatusText = () => {
    if (!loader) return "Not Found";
    if (loaderActive) return "Active";
    if (loader.status === "pending") return "Pending Reboot";
    if (loader.status === "unloaded") return "Unloaded";
    return "Disabled";
  };

  return (
    <>
      {/* Configure Button */}
      <PanelSection>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => Navigation.Navigate("/sysext-manager/settings")}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FaCog style={{ marginRight: 8 }} />
              Manage Extensions
            </div>
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      {/* Status Section */}
      <PanelSection title="Status">
        <PanelSectionRow>
          <div style={{ display: "flex", alignItems: "center" }}>
            <StatusIcon status={loader?.status || "disabled"} />
            <span>Extension Loader: {getLoaderStatusText()}</span>
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div style={{ display: "flex", alignItems: "center" }}>
            {sysextStatus.active ? (
              <FaCheck style={{ color: "#2ecc71", marginRight: 8 }} />
            ) : (
              <FaTimes style={{ color: "#e74c3c", marginRight: 8 }} />
            )}
            <span>Sysext Service: {sysextStatus.active ? "Active" : "Inactive"}</span>
          </div>
        </PanelSectionRow>
        {!sysextStatus.active && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={onEnableSysext}>
              Enable Sysext Service
            </ButtonItem>
          </PanelSectionRow>
        )}
      </PanelSection>

      {/* Enabled Extensions */}
      {enabledExtensions.length > 0 && (
        <PanelSection title="Enabled">
          {enabledExtensions.map((ext) => {
            const state = updateStates[ext.manifest.id];
            const hasAnyUpdate = ext.bundled_update_available || state?.available;
            const isChecking = state?.checking && !ext.bundled_update_available;
            return (
              <PanelSectionRow key={ext.manifest.id}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <StatusIcon
                    status={ext.status}
                    updateAvailable={hasAnyUpdate}
                    checkingUpdate={isChecking}
                  />
                  <span>{ext.manifest.name}</span>
                </div>
              </PanelSectionRow>
            );
          })}
        </PanelSection>
      )}
    </>
  );
}
