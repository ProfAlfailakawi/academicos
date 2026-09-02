import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { useI18n } from "../lib/i18n";

type AppDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  inputMode?: "none" | "text" | "textarea" | "password";
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function AppDialog({
  open,
  title,
  description,
  value = "",
  onValueChange,
  inputMode = "none",
  confirmLabel,
  cancelLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: AppDialogProps) {
  const { t } = useI18n();
  const firstField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement as HTMLElement | null;

    const timer = window.setTimeout(() => {
      firstField.current?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
      }

      if (
        event.key === "Enter" &&
        inputMode !== "textarea" &&
        !busy
      ) {
        event.preventDefault();
        void onConfirm();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [open, busy, inputMode, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        className="w-full max-w-lg rounded-3xl border hairline bg-[var(--surface)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b hairline p-5">
          <div>
            <h2 id="app-dialog-title" className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p className="body-copy mt-2 whitespace-pre-line">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            className="focus-ring rounded-xl p-2 muted"
            aria-label={t("ui.close")}
            onClick={onCancel}
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>

        {inputMode !== "none" && (
          <div className="p-5 pb-0">
            {inputMode === "textarea" ? (
              <textarea
                ref={firstField as React.RefObject<HTMLTextAreaElement>}
                value={value}
                onChange={(e) => onValueChange?.(e.target.value)}
                rows={5}
                className="focus-ring w-full resize-y rounded-2xl border hairline bg-[var(--bg)] px-4 py-3 text-sm"
              />
            ) : (
              <input
                ref={firstField as React.RefObject<HTMLInputElement>}
                type={inputMode === "password" ? "password" : "text"}
                value={value}
                onChange={(e) => onValueChange?.(e.target.value)}
                className="focus-ring w-full rounded-2xl border hairline bg-[var(--bg)] px-4 py-3 text-sm"
              />
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 p-5">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel || t("ui.cancel")}
          </Button>

          <Button
            type="button"
            variant={danger ? "destructive" : "default"}
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            {busy ? t("ui.working") : confirmLabel || t("ui.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
