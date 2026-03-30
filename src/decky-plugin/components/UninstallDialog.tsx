import { useState } from "react";
import {
  ConfirmModal,
  ToggleField,
  PanelSectionRow,
} from "@decky/ui";
import { UninstallPrompt } from "../types/manifest";

interface UninstallDialogProps {
  extensionName: string;
  prompts: UninstallPrompt[];
  onConfirm: (answers: Record<string, boolean>) => void;
  onCancel: () => void;
}

export function UninstallDialog({
  extensionName,
  prompts,
  onConfirm,
  onCancel,
}: UninstallDialogProps) {
  const [answers, setAnswers] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    prompts.forEach((p) => {
      defaults[p.id] = p.default;
    });
    return defaults;
  });

  return (
    <ConfirmModal
      strTitle={`Disable ${extensionName}`}
      strDescription="Configure uninstall options:"
      onOK={() => onConfirm(answers)}
      onCancel={onCancel}
      strOKButtonText="Disable"
      strCancelButtonText="Cancel"
    >
      {prompts.map((prompt) => (
        <PanelSectionRow key={prompt.id}>
          <ToggleField
            label={prompt.message}
            checked={answers[prompt.id]}
            onChange={(value: boolean) =>
              setAnswers((prev) => ({ ...prev, [prompt.id]: value }))
            }
          />
        </PanelSectionRow>
      ))}
    </ConfirmModal>
  );
}
