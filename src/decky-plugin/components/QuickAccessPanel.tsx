import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Spinner,
  Navigation,
} from "@decky/ui";
import { FaCog, FaCheck, FaClock, FaTimes } from "react-icons/fa";
import { Extension, ExtensionStatus } from "../types/manifest";

// Status icon component
function StatusIcon({ status }: { status: ExtensionStatus }) {
  switch (status) {
    case "active":
      return <FaCheck style={{ color: "#2ecc71", marginRight: 8 }} />;
    case "pending":
      return <FaClock style={{ color: "#f1c40f", marginRight: 8 }} />;
    default:
      return <FaTimes style={{ color: "#95a5a6", marginRight: 8 }} />;
  }
}

interface QuickAccessPanelProps {
  extensions: Extension[];
  loading: boolean;
  error: string | null;
}

export function QuickAccessPanel({ extensions, loading, error }: QuickAccessPanelProps) {
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

  const enabledExtensions = extensions.filter(
    (e) => e.manifest.id !== "loader" && (e.status === "active" || e.status === "pending")
  );

  const getLoaderStatusText = () => {
    if (!loader) return "Not Found";
    if (loaderActive) return "Active";
    if (loader.status === "pending") return "Pending Reboot";
    return "Disabled";
  };

  return (
    <>
      {/* Configure Button */}
      <PanelSection>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => Navigation.Navigate("/sysext-extensions/settings")}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FaCog style={{ marginRight: 8 }} />
              Configure Extensions
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
      </PanelSection>

      {/* Enabled Extensions */}
      {enabledExtensions.length > 0 && (
        <PanelSection title="Enabled">
          {enabledExtensions.map((ext) => (
            <PanelSectionRow key={ext.manifest.id}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <StatusIcon status={ext.status} />
                <span>{ext.manifest.name}</span>
              </div>
            </PanelSectionRow>
          ))}
        </PanelSection>
      )}
    </>
  );
}
