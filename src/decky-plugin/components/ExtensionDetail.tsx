import { PanelSection, PanelSectionRow, ToggleField, Focusable } from "@decky/ui";
import { FaChevronLeft } from "react-icons/fa";
import { Extension, ExtensionStatus } from "../types/manifest";
import { useEffect } from "react";

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

interface ExtensionDetailProps {
  extension: Extension;
  loaderEnabled: boolean;
  onBack: () => void;
  onToggle: (ext: Extension, enabled: boolean) => void;
}

export function ExtensionDetail({ extension, loaderEnabled, onBack, onToggle }: ExtensionDetailProps) {
  const { manifest, status, readme } = extension;
  const isLoader = manifest.id === "loader";
  const isEnabled = status === "active" || status === "pending";
  const canToggle = isLoader || loaderEnabled;

  // Scroll to top when detail page opens
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      {/* Header: Back button + Title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          gap: 12,
        }}
      >
        <Focusable
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 4,
            background: "rgba(255,255,255,0.1)",
            cursor: "pointer",
            fontSize: 13,
          }}
          onActivate={onBack}
        >
          <FaChevronLeft style={{ fontSize: 10 }} />
          <span>Back</span>
        </Focusable>
        <span style={{ fontSize: 18, fontWeight: "bold" }}>{manifest.name}</span>
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: "rgba(255,255,255,0.1)",
          margin: "0 16px 8px 16px",
        }}
      />

      {/* Status and Toggle */}
      <PanelSection>
        <PanelSectionRow>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>Status:</span>
              <StatusBadge status={status} />
            </div>
            <ToggleField
              checked={isEnabled}
              onChange={(v) => onToggle(extension, v)}
              disabled={!canToggle}
            />
          </div>
        </PanelSectionRow>

        {/* Description */}
        <PanelSectionRow>
          <div style={{ color: "#bdc3c7", fontSize: 14 }}>
            {manifest.description}
          </div>
        </PanelSectionRow>

        {/* Version */}
        {manifest.version && (
          <PanelSectionRow>
            <div style={{ color: "#7f8c8d", fontSize: 12 }}>
              Version: {manifest.version}
            </div>
          </PanelSectionRow>
        )}
      </PanelSection>

      {/* README Content */}
      {readme && (
        <PanelSection title="Details">
          <PanelSectionRow>
            <div
              style={{
                color: "#bdc3c7",
                fontSize: 13,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
              }}
            >
              {readme}
            </div>
          </PanelSectionRow>
        </PanelSection>
      )}
    </>
  );
}
