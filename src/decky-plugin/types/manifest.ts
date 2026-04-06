export interface UpdateManagerSection {
  script: string;
}

export interface UpdateInfo {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  loading: boolean;
  error?: string;
}

export interface ConfigParameterSegment {
  /** Percentage of the slider width this segment occupies (all segments must sum to 100) */
  width: number;
  /** Real value at the start of this segment */
  from: number;
  /** Real value at the end of this segment */
  to: number;
  /** Step size within this segment */
  step: number;
}

export interface ConfigParameter {
  id: string;
  label: string;
  description: string;
  type: "integer" | "duration" | "boolean" | "select";
  default: number | string | boolean;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  segments?: ConfigParameterSegment[];
  options?: { value: string; label: string }[];
}

export interface ConfigSection {
  path: string;
  parameters: ConfigParameter[];
}

export interface UninstallPrompt {
  id: string;
  message: string;
  default: boolean;
}

export interface UninstallSection {
  script: string;
  prompts?: UninstallPrompt[];
}

export interface ActivationSection {
  mode: "reboot" | "hot-reload" | "auto";
}

export interface ExtensionManifest {
  name: string;
  id: string;
  description: string;
  version: string;
  category: string;
  required?: boolean;
  release_status?: "release" | "experimental" | "disabled";  // defaults to "experimental" when absent
  activation: ActivationSection;
  config?: ConfigSection;
  configure?: { script: string };
  uninstall?: UninstallSection;
  update_manager?: UpdateManagerSection;
}

export type ExtensionStatus = "active" | "pending" | "unloaded" | "disabled";

export interface Extension {
  manifest: ExtensionManifest;
  enabled: boolean;
  status: ExtensionStatus;
  raw_file: string;
  readme: string;
  has_update_manager: boolean;
  bundled_update_available: boolean;
}

export interface ExtensionConfig {
  values: Record<string, string | number | boolean>;
  error?: string;
}
