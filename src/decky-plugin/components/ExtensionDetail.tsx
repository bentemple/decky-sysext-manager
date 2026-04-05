import { PanelSection, PanelSectionRow, ToggleField, Focusable, ButtonItem, showModal, ConfirmModal } from "@decky/ui";
import { FaChevronLeft, FaTimes, FaUpload } from "react-icons/fa";
import { Extension, ExtensionStatus, ConfigParameter, ConfigParameterSegment, ExtensionConfig, UpdateInfo } from "../types/manifest";
import { useEffect, useState, useCallback, useRef } from "react";
import { toaster } from "@decky/api";

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

// Convert a real value to a 0–100 slider position using segments
function realToSlider(value: number, segments: ConfigParameterSegment[]): number {
  let sliderOffset = 0;
  for (const seg of segments) {
    if (value <= seg.to) {
      const segFraction = (value - seg.from) / (seg.to - seg.from);
      return sliderOffset + segFraction * seg.width;
    }
    sliderOffset += seg.width;
  }
  return 100;
}

// Convert a 0–100 slider position to a snapped real value using segments
function sliderToReal(slider: number, segments: ConfigParameterSegment[]): number {
  let sliderOffset = 0;
  for (const seg of segments) {
    const segEnd = sliderOffset + seg.width;
    if (slider <= segEnd || seg === segments[segments.length - 1]) {
      const segFraction = Math.max(0, slider - sliderOffset) / seg.width;
      const rawValue = seg.from + segFraction * (seg.to - seg.from);
      // Snap to step
      const snapped = Math.round((rawValue - seg.from) / seg.step) * seg.step + seg.from;
      return Math.max(seg.from, Math.min(seg.to, snapped));
    }
    sliderOffset += seg.width;
  }
  return segments[segments.length - 1].to;
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
}: {
  param: ConfigParameter;
  value: string | number | boolean;
  onChange: (id: string, value: string | number | boolean) => void;
}) {
  const displayValue = value !== undefined && value !== null ? value : param.default;

  if (param.type === "boolean") {
    return (
      <PanelSectionRow>
        <ToggleField
          label={param.label}
          description={param.description}
          checked={Boolean(displayValue)}
          onChange={(v) => onChange(param.id, v)}
        />
      </PanelSectionRow>
    );
  }

  if (param.type === "integer" || param.type === "duration") {
    const numVal = Number(displayValue) || 0;
    const unit = param.unit ? ` ${param.unit}` : "";

    if (param.segments?.length) {
      const sliderVal = realToSlider(numVal, param.segments);
      const displayLabel = param.type === "duration" && param.unit === "min"
        ? formatMinutes(numVal)
        : `${numVal}${unit}`;

      return (
        <PanelSectionRow>
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>{param.label}</span>
              <span style={{ fontSize: 13, color: "#e8e8e8", fontWeight: "bold" }}>
                {displayLabel}
              </span>
            </div>
            {param.description && (
              <div style={{ color: "#8b929a", fontSize: 11, marginBottom: 8 }}>
                {param.description}
              </div>
            )}
            <input
              type="range"
              min={0}
              max={100}
              step={0.01}
              value={sliderVal}
              onChange={(e) => {
                const real = sliderToReal(Number(e.target.value), param.segments!);
                onChange(param.id, real);
              }}
              style={{ width: "100%", accentColor: "#1a9fff", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
              <span style={{ color: "#8b929a", fontSize: 10 }}>
                {param.type === "duration" && param.unit === "min"
                  ? formatMinutes(param.segments[0].from)
                  : `${param.segments[0].from}${unit}`}
              </span>
              <span style={{ color: "#8b929a", fontSize: 10 }}>
                {param.type === "duration" && param.unit === "min"
                  ? formatMinutes(param.segments[param.segments.length - 1].to)
                  : `${param.segments[param.segments.length - 1].to}${unit}`}
              </span>
            </div>
          </div>
        </PanelSectionRow>
      );
    }

    // Linear slider (no segments)
    const min = param.min ?? 0;
    const max = param.max ?? 9999;
    const step = param.step || 1;
    return (
      <PanelSectionRow>
        <div style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13 }}>{param.label}</span>
            <span style={{ fontSize: 13, color: "#e8e8e8", fontWeight: "bold" }}>
              {numVal}{unit}
            </span>
          </div>
          {param.description && (
            <div style={{ color: "#8b929a", fontSize: 11, marginBottom: 8 }}>
              {param.description}
            </div>
          )}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={numVal}
            onChange={(e) => onChange(param.id, Number(e.target.value))}
            style={{ width: "100%", accentColor: "#1a9fff", cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
            <span style={{ color: "#8b929a", fontSize: 10 }}>{min}{unit}</span>
            <span style={{ color: "#8b929a", fontSize: 10 }}>{max}{unit}</span>
          </div>
        </div>
      </PanelSectionRow>
    );
  }

  if (param.type === "select" && param.options) {
    return (
      <PanelSectionRow>
        <div style={{ width: "100%" }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>{param.label}</div>
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
      </PanelSectionRow>
    );
  }

  return null;
}

interface ExtensionDetailProps {
  extension: Extension;
  loaderEnabled: boolean;
  onBack: () => void;
  onToggle: (ext: Extension, enabled: boolean) => void;
  onLoadConfig: (extId: string) => Promise<ExtensionConfig>;
  onSaveConfig: (extId: string, config: Record<string, string | number>) => Promise<{ success: boolean; error?: string }>;
  onUpdateManager: (extId: string, flag: string) => Promise<{ success: boolean; output: string; error?: string }>;
  onUpdateExt: (extId: string) => Promise<{ success: boolean; needs_reboot?: boolean; error?: string }>;
}

export function ExtensionDetail({
  extension,
  loaderEnabled,
  onBack,
  onToggle,
  onLoadConfig,
  onSaveConfig,
  onUpdateManager,
  onUpdateExt,
}: ExtensionDetailProps) {
  const { manifest, status, readme } = extension;
  const isLoader = manifest.id === "loader";
  const isEnabled = status === "active" || status === "pending";
  // Allow disabling enabled extensions even when loader is disabled
  const canToggle = isLoader || loaderEnabled || isEnabled;
  const hasConfig = Boolean(manifest.config?.parameters?.length);
  const hasUpdateManager = extension.has_update_manager;

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

  // Track whether the header row has scrolled out of view
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerVisible, setHeaderVisible] = useState(true);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
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

  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      const result = await onUpdateManager(manifest.id, "--update");
      if (result.success) {
        toaster.toast({ title: `${manifest.name} Updated`, body: "Update complete." });
        loadUpdateInfo();
      } else {
        toaster.toast({ title: "Update Failed", body: result.error || "Unknown error" });
      }
    } finally {
      setUpdating(false);
    }
  }, [manifest.id, manifest.name, onUpdateManager, loadUpdateInfo]);

  const handleUpdateExt = useCallback(async () => {
    setUpdatingExt(true);
    try {
      const result = await onUpdateExt(manifest.id);
      if (result.success) {
        toaster.toast({
          title: `${manifest.name} Updated`,
          body: result.needs_reboot ? "Extension updated. Reboot required." : "Extension updated.",
        });
      } else {
        toaster.toast({ title: "Update Failed", body: result.error || "Unknown error" });
      }
    } finally {
      setUpdatingExt(false);
    }
  }, [manifest.id, manifest.name, onUpdateExt]);

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

  return (
    <Focusable onCancel={handleBack} style={{ display: "contents" }}>
      {/* Sticky X button - hidden at top, slides in as header scrolls away */}
      <div
        style={{
          position: "sticky",
          top: -14,
          zIndex: 10,
          display: "flex",
          justifyContent: "flex-end",
          padding: "0 16px",
          pointerEvents: "none",
          height: 0,
          overflow: "visible",
        }}
      >
        <Focusable
          style={{
            pointerEvents: headerVisible ? "none" : "auto",
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(40,42,48,0.9)",
            border: "1px solid rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            opacity: headerVisible ? 0 : 1,
            transform: headerVisible ? "translateY(-14px)" : "translateY(0)",
            transition: "opacity 0.15s ease, transform 0.15s ease",
          }}
          onActivate={handleBack}
        >
          <FaTimes style={{ fontSize: 12, color: "#ccc" }} />
        </Focusable>
      </div>

      {/* Header: Back button + Title (scrolls normally) */}
      <div
        ref={headerRef}
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
            flexShrink: 0,
          }}
          onActivate={handleBack}
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

      {/* Update */}
      {(hasUpdateManager || extension.bundled_update_available) && (
        <PanelSection title="Update">
          {/* Bundled extension .raw update */}
          {extension.bundled_update_available && (
            <>
              <PanelSectionRow>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <FaUpload style={{ color: "#f39c12" }} />
                  <span style={{ color: "#f39c12" }}>
                    Extension update available: v{manifest.version}
                  </span>
                </div>
              </PanelSectionRow>
              <PanelSectionRow>
                <ButtonItem
                  layout="below"
                  onClick={handleUpdateExt}
                  disabled={updatingExt}
                >
                  {updatingExt ? "Updating Extension..." : "Update Extension"}
                </ButtonItem>
              </PanelSectionRow>
            </>
          )}

          {/* Upstream software update (via update-manager) */}
          {hasUpdateManager && (
            updateInfo.loading ? (
              <PanelSectionRow>
                <div style={{ color: "#8b929a", fontSize: 13 }}>Checking upstream version...</div>
              </PanelSectionRow>
            ) : updateInfo.error ? (
              <PanelSectionRow>
                <div style={{ color: "#e74c3c", fontSize: 13 }}>{updateInfo.error}</div>
              </PanelSectionRow>
            ) : updateInfo.updateAvailable ? (
              <>
                <PanelSectionRow>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <FaUpload style={{ color: "#f39c12" }} />
                    <span style={{ color: "#f39c12" }}>
                      Upstream update: v{updateInfo.currentVersion} → v{updateInfo.latestVersion}
                    </span>
                  </div>
                </PanelSectionRow>
                <PanelSectionRow>
                  <ButtonItem
                    layout="below"
                    onClick={handleUpdate}
                    disabled={updating}
                  >
                    {updating ? "Updating..." : "Update Now"}
                  </ButtonItem>
                </PanelSectionRow>
              </>
            ) : (
              <PanelSectionRow>
                <div style={{ color: "#8b929a", fontSize: 13 }}>
                  Upstream: up to date{updateInfo.currentVersion ? ` (v${updateInfo.currentVersion})` : ""}
                </div>
              </PanelSectionRow>
            )
          )}
        </PanelSection>
      )}

      {/* Settings */}
      {hasConfig && (
        <PanelSection title="Settings">
          {configLoading && (
            <PanelSectionRow>
              <div style={{ color: "#8b929a", fontSize: 13 }}>Loading settings...</div>
            </PanelSectionRow>
          )}

          {configError && (
            <PanelSectionRow>
              <div style={{ color: "#e74c3c", fontSize: 13 }}>{configError}</div>
            </PanelSectionRow>
          )}

          {!configLoading && !configError && manifest.config!.parameters.map((param) => (
            <ConfigField
              key={param.id}
              param={param}
              value={configValues[param.id]}
              onChange={handleFieldChange}
            />
          ))}

          {isDirty && (
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                onClick={handleApply}
                disabled={configSaving}
              >
                {configSaving ? "Applying..." : "Apply"}
              </ButtonItem>
            </PanelSectionRow>
          )}
        </PanelSection>
      )}

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
    </Focusable>
  );
}
