import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { useI18n } from "../lib/i18n";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Shared modal behaviour for every dialog in the app: Escape closes, Tab focus
 * is trapped inside the dialog, initial focus moves into it and focus returns
 * to the opener on close. The page behind is kept from scrolling.
 */
export function useDialogA11y(
  dialogRef: RefObject<HTMLElement | null>,
  {
    open,
    onClose,
    busy = false,
    initialFocus,
    onKeyDown,
  }: {
    open: boolean;
    onClose: () => void;
    busy?: boolean;
    initialFocus?: RefObject<HTMLElement | null>;
    onKeyDown?: (event: KeyboardEvent) => void;
  },
) {
  const onCloseRef = useRef(onClose);
  const onKeyRef = useRef(onKeyDown);
  onCloseRef.current = onClose;
  onKeyRef.current = onKeyDown;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const node = dialogRef.current;
      if (!node) return;
      if (initialFocus?.current) return initialFocus.current.focus();
      if (node.contains(document.activeElement)) return;
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      (first || node).focus();
    }, 0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      onKeyRef.current?.(event);
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (!focusable.length) {
          event.preventDefault();
          dialogRef.current.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const inside = !!active && dialogRef.current.contains(active);
        if (event.shiftKey && (active === first || !inside)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !inside)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);
}

type DialogShellProps = {
  open?: boolean;
  /** Accessible name; rendered as the visible heading unless `header` is given. */
  title: string;
  description?: string;
  onClose: () => void;
  busy?: boolean;
  /** Replaces the default heading row (the title is still used as the accessible name). */
  header?: ReactNode;
  hideCloseButton?: boolean;
  children: ReactNode;
  /** Classes for the dialog surface (size, radius, background). */
  className?: string;
  /** Classes for the overlay (z-index, alignment, backdrop). */
  overlayClassName?: string;
  bodyClassName?: string;
  initialFocus?: RefObject<HTMLElement | null>;
};

/**
 * Accessible modal container (role=dialog, aria-modal, focus trap, Escape).
 * Use this instead of hand-rolled `fixed inset-0` overlays.
 */
export function DialogShell({
  open = true,
  title,
  description,
  onClose,
  busy = false,
  header,
  hideCloseButton = false,
  children,
  className = "relative panel rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col",
  overlayClassName = "fixed inset-0 z-[80] flex items-center justify-center p-4",
  bodyClassName = "p-5 overflow-auto flex-1 min-h-0",
  initialFocus,
}: DialogShellProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  useDialogA11y(ref, { open, onClose, busy, initialFocus });
  if (!open) return null;
  return (
    <div className={overlayClassName} role="presentation">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        onMouseDown={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={className}
      >
        {header ? (
          <>
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            {header}
          </>
        ) : (
          <div className="min-h-14 px-5 py-3 flex items-center justify-between gap-3 border-b hairline shrink-0">
            <div className="min-w-0">
              <h2 id={titleId} className="font-semibold">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-xs muted mt-1">
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <Button size="icon" variant="ghost" aria-label={t("ui.close")} onClick={onClose} disabled={busy}>
                <X size={18} />
              </Button>
            )}
          </div>
        )}
        <div className={bodyClassName}>{children}</div>
      </div>
    </div>
  );
}

/**
 * Minimal accessible frame for dialogs that draw their own header/layout:
 * overlay + role=dialog surface with focus trap and Escape handling.
 */
export function DialogFrame({
  onClose,
  labelledBy,
  label,
  busy = false,
  className,
  overlayClassName = "fixed inset-0 z-[80] flex items-center justify-center p-4",
  backdropClassName = "absolute inset-0 bg-black/35 backdrop-blur-sm",
  children,
}: {
  onClose: () => void;
  labelledBy?: string;
  label?: string;
  busy?: boolean;
  className?: string;
  overlayClassName?: string;
  backdropClassName?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useDialogA11y(ref, { open: true, onClose, busy });
  return (
    <div className={overlayClassName} role="presentation">
      <div
        className={backdropClassName}
        aria-hidden="true"
        onMouseDown={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        tabIndex={-1}
        className={className}
      >
        {children}
      </div>
    </div>
  );
}

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
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const titleId = useId();
  useDialogA11y(dialogRef, {
    open,
    onClose: onCancel,
    busy,
    initialFocus: inputMode === "none" ? undefined : (firstField as RefObject<HTMLElement | null>),
    onKeyDown: (event) => {
      if (event.key === "Enter" && inputMode !== "textarea" && !busy) {
        event.preventDefault();
        void onConfirm();
      }
    },
  });

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-y-auto overscroll-contain rounded-3xl border hairline bg-[var(--surface)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b hairline p-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
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
            variant={danger ? "danger" : "default"}
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
