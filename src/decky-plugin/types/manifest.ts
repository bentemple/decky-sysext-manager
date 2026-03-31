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
  status?: "release" | "experimental" | "disabled";  // defaults to "experimental"
  activation: ActivationSection;
  config?: ConfigSection;
  configure?: { script: string };
  uninstall?: UninstallSection;
}

export type ExtensionStatus = "active" | "pending" | "disabled";

export interface Extension {
  manifest: ExtensionManifest;
  enabled: boolean;
  status: ExtensionStatus;
  raw_file: string;
  readme: string;
}

export interface ExtensionConfig {
  values: Record<string, string | number | boolean>;
  error?: string;
}
