import {
  SliderField,
  ToggleField,
  DropdownItem,
  PanelSectionRow,
} from "@decky/ui";
import { ConfigParameter } from "../types/manifest";

interface ConfigRendererProps {
  parameters: ConfigParameter[];
  values: Record<string, string | number | boolean>;
  onChange: (id: string, value: string | number | boolean) => void;
}

export function ConfigRenderer({ parameters, values, onChange }: ConfigRendererProps) {
  return (
    <>
      {parameters.map((param) => {
        const currentValue = values[param.id] ?? param.default;

        switch (param.type) {
          case "integer":
          case "duration":
            return (
              <PanelSectionRow key={param.id}>
                <SliderField
                  label={param.label}
                  description={param.description}
                  value={typeof currentValue === "number" ? currentValue : Number(currentValue)}
                  min={param.min ?? 0}
                  max={param.max ?? 100}
                  step={param.step ?? 1}
                  showValue={true}
                  valueSuffix={param.unit ? ` ${param.unit}` : undefined}
                  onChange={(value: number) => {
                    // For duration type, convert to systemd timespan format
                    if (param.type === "duration" && param.unit) {
                      onChange(param.id, `${value}${param.unit}`);
                    } else {
                      onChange(param.id, value);
                    }
                  }}
                />
              </PanelSectionRow>
            );

          case "boolean":
            return (
              <PanelSectionRow key={param.id}>
                <ToggleField
                  label={param.label}
                  description={param.description}
                  checked={Boolean(currentValue)}
                  onChange={(value: boolean) => onChange(param.id, value)}
                />
              </PanelSectionRow>
            );

          case "select":
            return (
              <PanelSectionRow key={param.id}>
                <DropdownItem
                  label={param.label}
                  description={param.description}
                  menuLabel={param.label}
                  rgOptions={(param.options ?? []).map((opt) => ({
                    data: opt.value,
                    label: opt.label,
                  }))}
                  selectedOption={String(currentValue)}
                  onChange={(option: { data: string }) => onChange(param.id, option.data)}
                />
              </PanelSectionRow>
            );

          default:
            return null;
        }
      })}
    </>
  );
}
