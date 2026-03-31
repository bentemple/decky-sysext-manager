import { Focusable, ToggleField } from "@decky/ui";
import { Extension } from "../types/manifest";
import { StatusBadge } from "./StatusBadge";

interface ExtensionRowProps {
  extension: Extension;
  loaderEnabled: boolean;
  onToggle: (ext: Extension, enabled: boolean) => void;
  onSelect: (ext: Extension) => void;
}

export function ExtensionRow({ extension, loaderEnabled, onToggle, onSelect }: ExtensionRowProps) {
  const { manifest, status } = extension;
  const isLoader = manifest.id === "loader";
  const isEnabled = status === "active" || status === "pending";

  // Can't enable extensions if loader is not enabled (except loader itself)
  const canToggle = isLoader || loaderEnabled;

  return (
    <Focusable
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 0",
        cursor: "pointer",
      }}
      onActivate={() => onSelect(extension)}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontWeight: isLoader ? "bold" : "normal" }}>
            {manifest.name}
          </span>
          <StatusBadge status={status} />
          {isLoader && (
            <span style={{ marginLeft: 8, color: "#e74c3c", fontSize: 12 }}>
              (Required)
            </span>
          )}
        </div>
      </div>
      <ToggleField
        checked={isEnabled}
        onChange={(v) => onToggle(extension, v)}
        disabled={!canToggle}
      />
    </Focusable>
  );
}
