import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Spinner,
  Navigation,
} from "@decky/ui";
import { FaCog } from "react-icons/fa";
import { Extension } from "../types/manifest";
import { StatusIcon } from "./StatusIcon";

interface QuickAccessViewProps {
  extensions: Extension[];
  loading: boolean;
  error: string | null;
}

export function QuickAccessView({ extensions, loading, error }: QuickAccessViewProps) {
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

  // Find loader extension
  const loader = extensions.find((e) => e.manifest.id === "loader");
  const loaderActive = loader?.status === "active";

  // Get enabled extensions (active or pending), excluding loader
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

      {/* Configure Button */}
      <PanelSection>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => Navigation.Navigate("/steamos-extensions/settings")}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FaCog style={{ marginRight: 8 }} />
              Configure Extensions
            </div>
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}
