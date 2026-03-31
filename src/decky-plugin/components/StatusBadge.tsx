import { ExtensionStatus } from "../types/manifest";

const STATUS_STYLES: Record<ExtensionStatus, { bg: string; text: string; label: string }> = {
  active: { bg: "#27ae60", text: "#fff", label: "Active" },
  pending: { bg: "#f39c12", text: "#fff", label: "Pending" },
  disabled: { bg: "#7f8c8d", text: "#fff", label: "Disabled" },
};

interface StatusBadgeProps {
  status: ExtensionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  return (
    <span
      style={{
        backgroundColor: style.bg,
        color: style.text,
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 12,
        marginLeft: 8,
      }}
    >
      {style.label}
    </span>
  );
}
