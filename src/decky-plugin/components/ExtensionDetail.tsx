import { PanelSection, PanelSectionRow, ToggleField, ButtonItem } from "@decky/ui";
import { Extension } from "../types/manifest";
import { StatusBadge } from "./StatusBadge";

interface ExtensionDetailProps {
  extension: Extension;
  loaderEnabled: boolean;
  onBack: () => void;
  onToggle: (ext: Extension, enabled: boolean) => void;
}

export function ExtensionDetail({ extension, loaderEnabled, onBack, onToggle }: ExtensionDetailProps) {
  const { manifest, status } = extension;
  const isLoader = manifest.id === "loader";
  const isEnabled = status === "active" || status === "pending";
  const canToggle = isLoader || loaderEnabled;

  return (
    <>
      <PanelSection>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={onBack}>
            ← Back
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title={manifest.name}>
        <PanelSectionRow>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>
              Status: <StatusBadge status={status} />
            </span>
            <ToggleField
              checked={isEnabled}
              onChange={(v) => onToggle(extension, v)}
              disabled={!canToggle}
            />
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div style={{ color: "#bdc3c7", fontSize: 14 }}>
            {manifest.description}
          </div>
        </PanelSectionRow>
        {manifest.version && (
          <PanelSectionRow>
            <div style={{ color: "#7f8c8d", fontSize: 12 }}>
              Version: {manifest.version}
            </div>
          </PanelSectionRow>
        )}
      </PanelSection>
    </>
  );
}
