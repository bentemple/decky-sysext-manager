import { FaCheck, FaClock, FaTimes } from "react-icons/fa";
import { ExtensionStatus } from "../types/manifest";

interface StatusIconProps {
  status: ExtensionStatus;
}

export function StatusIcon({ status }: StatusIconProps) {
  switch (status) {
    case "active":
      return <FaCheck style={{ color: "#2ecc71", marginRight: 8 }} />;
    case "pending":
      return <FaClock style={{ color: "#f1c40f", marginRight: 8 }} />;
    default:
      return <FaTimes style={{ color: "#95a5a6", marginRight: 8 }} />;
  }
}
