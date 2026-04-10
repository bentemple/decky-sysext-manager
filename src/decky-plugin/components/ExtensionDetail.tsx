import { DialogBody, DialogControlsSection, Field, ToggleField, Focusable, ButtonItem, showModal, ConfirmModal, SliderField } from "@decky/ui";
import { FaChevronLeft, FaTimes, FaUpload } from "react-icons/fa";
import { Extension, ExtensionStatus, ConfigParameter, ExtensionConfig, UpdateInfo } from "../types/manifest";
import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import { showToast } from "../utils/toast";
import { Logger } from "../utils/logger";

// Custom hook to proactively focus elements on touch/mouse to prevent scroll jumps
function useInputAwareFocus(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // When user touches an interactive element, focus it immediately if it's not already focused
    const handlePointerDown = (e: PointerEvent) => {
      // Only handle touch inputs, not mouse or pen
      if (e.pointerType !== 'touch') return;

      const target = e.target as HTMLElement;

      // Check if we're directly interacting with button, slider, sliderField, or toggle
      const isTargetElement =
        target.tagName === 'BUTTON' ||
        target.closest('button') ||
        (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range') ||
        target.classList.contains('gamepaddialog_Toggle_24aLH') ||
        (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox');

      if (!isTargetElement) return; // Let other touch inputs continue normally

      // Find the focusable ancestor (Field, Focusable, ButtonItem, etc.)
      let focusableElement: HTMLElement | null = target;
      while (focusableElement && focusableElement !== container) {
        if (
          focusableElement.hasAttribute('tabindex') ||
          focusableElement.classList.contains('gamepaddialog_Field_S-5XY') || // Decky Field
          focusableElement.classList.contains('gamepaddialog_Focusable_1-LxQ') // Decky Focusable
        ) {
          // Check if this element is not currently focused
          if (document.activeElement !== focusableElement) {
            // Focus it with preventScroll to avoid the jump
            focusableElement.focus({ preventScroll: true });
          }
          break;
        }
        focusableElement = focusableElement.parentElement;
      }
    };

    container.addEventListener('pointerdown', handlePointerDown, { capture: true });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    };
  }, [containerRef]);
}

// Status badge component
function StatusBadge({ status }: { status: ExtensionStatus }) {
  const colors: Record<ExtensionStatus, string> = {
    active: "#2ecc71",
    pending: "#f1c40f",
    unloaded: "#e67e22",
    disabled: "#95a5a6",
  };
  const labels: Record<ExtensionStatus, string> = {
    active: "Active",
    pending: "Pending",
    unloaded: "Unloaded",
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

// Parse README into sections and break long sections into chunks
interface ReadmeSection {
  title?: string;
  content: string;
  level: number; // 1 for #, 2 for ##, 3 for ###
}

function parseReadme(readme: string): ReadmeSection[] {
  const lines = readme.split('\n');
  const sections: ReadmeSection[] = [];
  let currentSection: ReadmeSection | null = null;
  const MAX_LINES_PER_CHUNK = 10; // Roughly half screen height

  for (const line of lines) {
    // Check for headers
    const h1Match = line.match(/^#\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);

    if (h1Match || h2Match || h3Match) {
      // Save previous section if exists
      if (currentSection) {
        sections.push(currentSection);
      }
      // Start new section
      currentSection = {
        title: h1Match?.[1] || h2Match?.[1] || h3Match?.[1],
        content: '',
        level: h1Match ? 1 : h2Match ? 2 : 3,
      };
    } else {
      // Add line to current section
      if (!currentSection) {
        // No header yet, create a default section
        currentSection = { content: '', level: 0 };
      }
      currentSection.content += (currentSection.content ? '\n' : '') + line;
    }
  }

  // Push last section
  if (currentSection) {
    sections.push(currentSection);
  }

  // Break long sections into chunks
  const chunkedSections: ReadmeSection[] = [];
  for (const section of sections) {
    const contentLines = section.content.split('\n');
    if (contentLines.length <= MAX_LINES_PER_CHUNK) {
      chunkedSections.push(section);
    } else {
      // Split into chunks
      for (let i = 0; i < contentLines.length; i += MAX_LINES_PER_CHUNK) {
        const chunk = contentLines.slice(i, i + MAX_LINES_PER_CHUNK).join('\n');
        chunkedSections.push({
          title: i === 0 ? section.title : undefined, // Only first chunk gets title
          content: chunk,
          level: section.level,
        });
      }
    }
  }

  return chunkedSections;
}

// Format a minute value as a human-readable string
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return h === 0 ? `${d}d` : `${d}d ${h}h`;
}

// Single config parameter field
function ConfigField({
  param,
  value,
  onChange,
  logger,
}: {
  param: ConfigParameter;
  value: string | number | boolean;
  onChange: (id: string, value: string | number | boolean) => void;
  logger: Logger;
}) {
  const displayValue = value !== undefined && value !== null ? value : param.default;

  const logUI = async (message: string) => {
    try {
      await logger.info(message);
    } catch (e) {
      console.error("Failed to log:", e);
    }
  };

  if (param.type === "boolean") {
    return (
      <ToggleField
        label={param.label}
        description={param.description}
        checked={Boolean(displayValue)}
        onChange={(v) => onChange(param.id, v)}
      />
    );
  }

  if (param.type === "integer" || param.type === "duration") {
    const numVal = Number(displayValue) || 0;
    const unit = param.unit ? ` ${param.unit}` : "";

    if (param.segments?.length) {
      // Segmented slider: translate between real value and 0-100 slider position

      logUI(`[${param.id}] Loading segmented slider - displayValue: ${displayValue}, numVal: ${numVal}, default: ${param.default}`);

      // Convert real value to slider position (0-100)
      const realToSlider = (real: number): number => {
        let sliderOffset = 0;
        for (const seg of param.segments!) {
          if (real <= seg.to) {
            const segFraction = (real - seg.from) / (seg.to - seg.from);
            return sliderOffset + segFraction * seg.width;
          }
          sliderOffset += seg.width;
        }
        return 100;
      };

      // Convert slider position (0-100) to real value
      const sliderToReal = (slider: number): number => {
        let sliderOffset = 0;
        for (const seg of param.segments!) {
          const segEnd = sliderOffset + seg.width;
          if (slider <= segEnd || seg === param.segments![param.segments!.length - 1]) {
            const segFraction = Math.max(0, slider - sliderOffset) / seg.width;
            const rawValue = seg.from + segFraction * (seg.to - seg.from);
            // Snap to step
            const snapped = Math.round((rawValue - seg.from) / seg.step) * seg.step + seg.from;
            return Math.max(seg.from, Math.min(seg.to, snapped));
          }
          sliderOffset += seg.width;
        }
        return param.segments![param.segments!.length - 1].to;
      };

      const sliderValue = realToSlider(numVal);
      logUI(`[${param.id}] numVal: ${numVal}, sliderValue: ${sliderValue}, segments: ${JSON.stringify(param.segments)}`);
      const formatValue = (val: number) =>
        param.type === "duration" && param.unit === "min"
          ? formatMinutes(val)
          : `${val}${unit}`;

      // Create notches evenly distributed across 0-100, then translate to real values
      const notchCountValue = param.notchCount ?? (param.segments.length + 1);
      const notchLabels = [];

      for (let i = 0; i < notchCountValue; i++) {
        const sliderPos = (i / (notchCountValue - 1)) * 100;
        const realValue = sliderToReal(sliderPos);
        notchLabels.push({
          notchIndex: i,
          label: formatValue(realValue),
          value: realValue,
        });
      }

      return (
        <SliderField
          label={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <span>{param.label}</span>
              <span style={{ fontSize: 14, color: "#e8e8e8" }}>
                {formatValue(numVal)}
              </span>
            </div>
          }
          description={param.description}
          value={sliderValue}
          min={0}
          max={100}
          step={1}
          showValue={false}
          notchCount={notchCountValue}
          notchLabels={notchLabels}
          notchTicksVisible={true}
          onChange={(sliderPos) => {
            const realValue = sliderToReal(sliderPos);
            onChange(param.id, realValue);
          }}
          bottomSeparator="none"
        />
      );
    }

    // Linear slider (no segments): use notchCount from manifest or default to 10
    const min = param.min ?? 0;
    const max = param.max ?? 9999;
    const step = param.step || 1;
    const notchCountValue = param.notchCount ?? 10;

    const notchLabels = [];
    for (let i = 0; i <= notchCountValue; i++) {
      const value = min + (i / notchCountValue) * (max - min);
      notchLabels.push({
        notchIndex: i,
        label: `${Math.round(value)}${unit}`,
        value: value,
      });
    }

    return (
      <SliderField
        label={param.label}
        description={param.description}
        value={numVal}
        min={min}
        max={max}
        step={step}
        showValue={true}
        valueSuffix={unit}
        notchCount={notchCountValue + 1}
        notchLabels={notchLabels}
        notchTicksVisible={true}
        onChange={(val) => onChange(param.id, val)}
        bottomSeparator="none"
      />
    );
  }

  if (param.type === "select" && param.options) {
    return (
      <Field
        focusable={true}
        label={param.label}
        description={
          <div style={{ width: "100%" }}>
            {param.description && (
              <div style={{ color: "#8b929a", fontSize: 11, marginBottom: 6 }}>
                {param.description}
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {param.options.map((opt) => (
                <Focusable
                  key={opt.value}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    fontSize: 12,
                    background: String(displayValue) === opt.value
                      ? "#1a9fff"
                      : "rgba(255,255,255,0.1)",
                    cursor: "pointer",
                  }}
                  onActivate={() => onChange(param.id, opt.value)}
                >
                  {opt.label}
                </Focusable>
              ))}
            </div>
          </div>
        }
      />
    );
  }

  return null;
}

interface ExtensionDetailProps {
  extension: Extension;
  loaderEnabled: boolean;
  logger: Logger;
  onBack: () => void;
  onToggle: (ext: Extension, enabled: boolean) => Promise<void>;
  onLoadConfig: (extId: string) => Promise<ExtensionConfig>;
  onSaveConfig: (extId: string, config: Record<string, string | number>) => Promise<{ success: boolean; error?: string }>;
  onUpdateManager: (extId: string, flag: string) => Promise<{ success: boolean; output: string; error?: string }>;
  onUpdateExt: (extId: string) => Promise<{ success: boolean; needs_reboot?: boolean; error?: string }>;
  onEnableSysext: () => Promise<{ success: boolean; error?: string }>;
  onUpdateComplete?: (extId: string) => void;
  onRefresh: () => Promise<Extension | undefined>;
}

export function ExtensionDetail({
  extension: initialExtension,
  loaderEnabled,
  logger,
  onBack,
  onToggle,
  onLoadConfig,
  onSaveConfig,
  onUpdateManager,
  onUpdateExt,
  onEnableSysext,
  onUpdateComplete,
  onRefresh,
}: ExtensionDetailProps) {
  // Local state for extension - updates after actions
  const [extension, setExtension] = useState(initialExtension);
  const { manifest, status, readme } = extension;
  const isLoader = manifest.id === "loader";
  const isEnabled = status === "active" || status === "pending" || status === "unloaded";
  // Allow toggling if: it's the loader, OR loader is enabled, OR extension is already enabled (can always disable)
  const canToggle = isLoader || loaderEnabled || isEnabled;
  const hasConfig = Boolean(manifest.config?.parameters?.length);
  const hasUpdateManager = extension.has_update_manager;

  // Refresh local extension state
  const refreshExtension = useCallback(async () => {
    const updated = await onRefresh();
    if (updated) {
      setExtension(updated);
    }
  }, [onRefresh]);

  const [configValues, setConfigValues] = useState<Record<string, string | number | boolean>>({});
  const [savedValues, setSavedValues] = useState<Record<string, string | number | boolean>>({});
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    currentVersion: null,
    latestVersion: null,
    updateAvailable: false,
    loading: true,
  });
  const [updating, setUpdating] = useState(false);
  const [updatingExt, setUpdatingExt] = useState(false);

  const isDirty = hasConfig && JSON.stringify(configValues) !== JSON.stringify(savedValues);

  const backButtonRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use input-aware focus to prevent scroll jumps on touch/mouse, but allow for gamepad
  useInputAwareFocus(containerRef);

  // Auto-focus back button on mount so B button works immediately
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      backButtonRef.current?.focus();
    });
  }, []);

  // Load config on mount
  useEffect(() => {
    if (hasConfig) {
      setConfigLoading(true);
      onLoadConfig(manifest.id)
        .then((cfg) => {
          if (cfg.error) {
            setConfigError(cfg.error);
          } else {
            setConfigValues({ ...cfg.values });
            setSavedValues({ ...cfg.values });
          }
        })
        .catch((e) => setConfigError(String(e)))
        .finally(() => setConfigLoading(false));
    }
  }, [manifest.id, hasConfig]);

  // Load update info on mount (if update-manager is present)
  const loadUpdateInfo = useCallback(() => {
    if (!hasUpdateManager) return;
    setUpdateInfo((prev) => ({ ...prev, loading: true }));
    Promise.all([
      onUpdateManager(manifest.id, "--get-current-version"),
      onUpdateManager(manifest.id, "--get-latest-version"),
    ]).then(([cur, lat]) => {
      const current = cur.output?.trim() || null;
      const latest = lat.output?.trim() || null;
      setUpdateInfo({
        currentVersion: current,
        latestVersion: latest,
        updateAvailable: !!latest && !!current && current !== latest,
        loading: false,
      });
    }).catch((e) => {
      setUpdateInfo({ currentVersion: null, latestVersion: null, updateAvailable: false, loading: false, error: String(e) });
    });
  }, [manifest.id, hasUpdateManager, onUpdateManager]);

  useEffect(() => {
    loadUpdateInfo();
  }, [loadUpdateInfo]);

  const handleFieldChange = useCallback((id: string, value: string | number | boolean) => {
    setConfigValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleApply = useCallback(async () => {
    setConfigSaving(true);
    setConfigError(null);
    try {
      const result = await onSaveConfig(
        manifest.id,
        configValues as Record<string, string | number>
      );
      if (result.success) {
        setSavedValues({ ...configValues });
      } else {
        setConfigError(result.error || "Failed to save settings");
      }
    } finally {
      setConfigSaving(false);
    }
  }, [manifest.id, configValues, onSaveConfig]);

  const handleReset = useCallback(() => {
    setConfigValues({ ...savedValues });
  }, [savedValues]);

  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      const result = await onUpdateManager(manifest.id, "--update");
      if (result.success) {
        showToast({ title: `${manifest.name} Updated`, body: "Update complete." });
        loadUpdateInfo();
        onUpdateComplete?.(manifest.id);
      } else {
        showToast({ title: "Update Failed", body: result.error || "Unknown error" });
      }
    } finally {
      setUpdating(false);
    }
  }, [manifest.id, manifest.name, onUpdateManager, loadUpdateInfo, onUpdateComplete]);

  const handleUpdateExt = useCallback(async () => {
    setUpdatingExt(true);
    try {
      const result = await onUpdateExt(manifest.id);
      if (result.success) {
        showToast({
          title: `${manifest.name} Updated`,
          body: result.needs_reboot ? "Extension updated. Reboot required." : "Extension updated.",
        });
        onUpdateComplete?.(manifest.id);
        await refreshExtension();
      } else {
        showToast({ title: "Update Failed", body: result.error || "Unknown error" });
      }
    } finally {
      setUpdatingExt(false);
    }
  }, [manifest.id, manifest.name, onUpdateExt, onUpdateComplete, refreshExtension]);

  const handleBack = useCallback(() => {
    if (isDirty) {
      showModal(
        <ConfirmModal
          strTitle="Unsaved Changes"
          strDescription="You have unsaved settings changes. Apply them before leaving?"
          strOKButtonText="Apply"
          strCancelButtonText="Discard"
          onOK={async () => {
            await handleApply();
            onBack();
          }}
          onCancel={() => {
            onBack();
          }}
        />
      );
    } else {
      onBack();
    }
  }, [isDirty, handleApply, onBack]);

  const handleEnableSysext = useCallback(async () => {
    const result = await onEnableSysext();
    if (result.success) {
      showToast({ title: "Sysext Service Enabled", body: "Extensions are now mounted." });
      await refreshExtension();
    } else {
      showToast({ title: "Failed to Enable", body: result.error || "Unknown error" });
    }
  }, [onEnableSysext, refreshExtension]);

  // Wrap toggle to refresh extension state after completion
  const handleToggle = useCallback(async (enabled: boolean) => {
    await onToggle(extension, enabled);
    await refreshExtension();
  }, [extension, onToggle, refreshExtension]);

  return (
    <DialogBody>
      <DialogControlsSection ref={containerRef}>
        {/* Sticky X button container */}
        <div style={{ position: "sticky", top: 0, zIndex: 100, height: 0, pointerEvents: "none" }}>
          <Focusable
            style={{
              position: "absolute",
              top: 8,
              right: 16,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(40,42,48,0.9)",
              border: "1px solid rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              pointerEvents: "auto",
            }}
            onActivate={handleBack}
            onCancel={handleBack}
          >
            <FaTimes style={{ fontSize: 12, color: "#ccc" }} />
          </Focusable>
        </div>

        {/* Header: Back button + Title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 0 12px 0",
            gap: 12,
            position: "relative",
          }}
        >
          {/* Back button */}
          <Focusable
            ref={backButtonRef}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 4,
              background: "rgba(255,255,255,0.1)",
              cursor: "pointer",
              fontSize: 13,
              flexShrink: 0,
            }}
            onActivate={handleBack}
            onCancel={handleBack}
          >
            <FaChevronLeft style={{ fontSize: 10 }} />
            <span>Back</span>
          </Focusable>

          <span style={{ fontSize: 18, fontWeight: "bold", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {manifest.name}
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.1)",
            margin: "0 0 8px 0",
          }}
        />

        {/* Status and Toggle - auto-focused on mount for B button */}
        <Focusable
          ref={statusRef}
          onCancel={handleBack}
          // @ts-ignore
          focusableIfNoChildren={true}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>Status:</span>
              <StatusBadge status={status} />
            </div>
            <ToggleField
              checked={isEnabled}
              onChange={handleToggle}
              disabled={!canToggle}
              bottomSeparator="none"
            />
          </div>
        </Focusable>

        {/* Description */}
        <Field
          focusable={true}
          description={manifest.description}
        />

        {/* Version */}
        {manifest.version && (
          <Field
            focusable={true}
            description={`Version: ${manifest.version}`}
          />
        )}

      {/* Unloaded Warning - show for all unloaded extensions */}
      {status === "unloaded" && (
        <Field
          focusable={true}
          description={
            <div style={{
              background: "rgba(230, 126, 34, 0.1)",
              border: "1px solid #e67e22",
              borderRadius: 4,
              padding: 12,
              color: "#e67e22",
              fontSize: 13
            }}>
              {isLoader
                ? "Extensions are unloaded because systemd-sysext is not running. This typically happens after a SteamOS update when persistence is disabled."
                : "This extension is unloaded because systemd-sysext is not running."}
            </div>
          }
        />
      )}

      {/* Enable Sysext Service button - only show for loader when unloaded */}
      {status === "unloaded" && isLoader && (
        <ButtonItem
          layout="below"
          onClick={handleEnableSysext}
          bottomSeparator="none"
        >
          Enable Sysext Service
        </ButtonItem>
      )}

      {/* Update Section Header */}
      {(hasUpdateManager || extension.bundled_update_available) && (
        <Focusable
          // @ts-ignore
          focusableIfNoChildren={true}
          onCancel={handleBack}
          style={{ marginTop: 16 }}
        >
          <span style={{ fontSize: "1.1em", fontWeight: "bold" }}>Update</span>
          <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.1)", marginTop: 4 }} />
        </Focusable>
      )}

      {/* Bundled extension .raw update */}
      {extension.bundled_update_available && (
        <>
          <Field
            focusable={true}
            description={
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <FaUpload style={{ color: "#f39c12" }} />
                <span style={{ color: "#f39c12" }}>
                  Extension update available: v{manifest.version}
                </span>
              </div>
            }
          />
          <ButtonItem
            layout="below"
            onClick={handleUpdateExt}
            disabled={updatingExt}
          >
            {updatingExt ? "Updating Extension..." : "Update Extension"}
          </ButtonItem>
        </>
      )}

      {/* Upstream software update (via update-manager) */}
      {hasUpdateManager && (
        updateInfo.loading ? (
          <Field
            focusable={true}
            description={<span style={{ color: "#8b929a", fontSize: 13 }}>Checking upstream version...</span>}
          />
        ) : updateInfo.error ? (
          <Field
            focusable={true}
            description={<span style={{ color: "#e74c3c", fontSize: 13 }}>{updateInfo.error}</span>}
          />
        ) : updateInfo.updateAvailable ? (
          <>
            <Field
              focusable={true}
              description={
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <FaUpload style={{ color: "#f39c12" }} />
                  <span style={{ color: "#f39c12" }}>
                    Upstream update: v{updateInfo.currentVersion} → v{updateInfo.latestVersion}
                  </span>
                </div>
              }
            />
            <ButtonItem
              layout="below"
              onClick={handleUpdate}
              disabled={updating}
            >
              {updating ? "Updating..." : "Update Now"}
            </ButtonItem>
          </>
        ) : (
          <Field
            focusable={true}
            description={
              <span style={{ color: "#8b929a", fontSize: 13 }}>
                Upstream: up to date{updateInfo.currentVersion ? ` (v${updateInfo.currentVersion})` : ""}
              </span>
            }
          />
        )
      )}

      {/* Settings Section */}
      {hasConfig && (
        <Focusable
          style={{ marginTop: 16 }}
          onCancel={handleBack}
        >
          {/* Settings Header */}
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: "1.1em", fontWeight: "bold" }}>Settings</span>
            <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.1)", marginTop: 4 }} />
          </div>

          {configLoading && (
            <Field
              focusable={true}
              description={<span style={{ color: "#8b929a", fontSize: 13 }}>Loading settings...</span>}
            />
          )}

          {configError && (
            <Field
              focusable={true}
              description={<span style={{ color: "#e74c3c", fontSize: 13 }}>{configError}</span>}
            />
          )}

          {!configLoading && !configError && manifest.config!.parameters.map((param) => (
            <ConfigField
              key={param.id}
              param={param}
              value={configValues[param.id]}
              onChange={handleFieldChange}
              logger={logger}
            />
          ))}

          {isDirty && (
            <>
              <Focusable
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 8,
                  justifyContent: "center",
                }}
                flow-children="horizontal"
              >
                <ButtonItem
                  layout="below"
                  onClick={handleReset}
                  disabled={configSaving}
                  bottomSeparator="none"
                >
                  Reset
                </ButtonItem>
                <ButtonItem
                  layout="below"
                  onClick={handleApply}
                  disabled={configSaving}
                  bottomSeparator="none"
                >
                  {configSaving ? "Applying..." : "Apply"}
                </ButtonItem>
              </Focusable>
              <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.1)", marginTop: 12 }} />
            </>
          )}
        </Focusable>
      )}

      {/* README Sections */}
      {readme && (
        <>
          {/* README Header */}
          <Focusable
            // @ts-ignore
            focusableIfNoChildren={true}
            onCancel={handleBack}
            style={{ marginTop: 16 }}
          >
            <span style={{ fontSize: "1.1em", fontWeight: "bold" }}>README</span>
            <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.1)", marginTop: 4 }} />
          </Focusable>

          {/* README Content Sections */}
          {parseReadme(readme).map((section, index, sections) => {
            // Check if the next section is a continuation (no title) of this section
            const nextSection = sections[index + 1];
            const isBeforeContinuation = nextSection && !nextSection.title;

            return (
              <Field
                key={`readme-${index}`}
                focusable={true}
                label={section.title ? (
                  <span style={{
                    fontSize: section.level === 1 ? 16 : section.level === 2 ? 14 : 13,
                    fontWeight: "bold",
                  }}>
                    {section.title}
                  </span>
                ) : undefined}
                bottomSeparator={isBeforeContinuation ? "none" : undefined}
                description={
                <div
                  style={{
                    color: "#bdc3c7",
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                  }}
                >
                  {section.content}
                </div>
              }
            />
            );
          })}
        </>
      )}
      </DialogControlsSection>
    </DialogBody>
  );
}
