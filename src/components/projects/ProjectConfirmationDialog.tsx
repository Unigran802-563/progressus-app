"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";

type ProjectConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  icon: ReactNode;
  variant?: "warning" | "danger";
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ProjectConfirmationDialog({
  open,
  title,
  description,
  icon,
  variant = "warning",
  confirmLabel,
  pendingLabel,
  pending,
  error,
  onClose,
  onConfirm,
}: ProjectConfirmationDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const controlsRef = useRef({ pending, onClose });

  useEffect(() => {
    controlsRef.current = { pending, onClose };
  }, [pending, onClose]);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement;
    // The trigger may disappear after removing a member. Keep a nearby safe
    // control as a fallback instead of leaving focus on the document body.
    const previousButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"))
      .filter((button) => !dialogRef.current?.contains(button));
    const previousIndex = previousButtons.indexOf(previousFocus as HTMLButtonElement);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    function focusInside() {
      if (controlsRef.current.pending) {
        dialogRef.current?.focus();
      } else {
        cancelRef.current?.focus();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!controlsRef.current.pending) controlsRef.current.onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!first || !last) {
        event.preventDefault();
        dialogRef.current.focus();
      } else if (event.shiftKey && (active === first || active === dialogRef.current || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || active === dialogRef.current || !dialogRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) {
        focusInside();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocusIn);
      document.body.style.overflow = previousOverflow;

      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      } else if (previousIndex >= 0) {
        const fallback = previousButtons.slice(previousIndex + 1).find((button) => button.isConnected)
          ?? previousButtons.slice(0, previousIndex).reverse().find((button) => button.isConnected);
        fallback?.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (open && pending) dialogRef.current?.focus();
  }, [open, pending]);

  if (!open) return null;

  const iconClassName = variant === "danger"
    ? "bg-danger/10 text-danger"
    : "bg-warning/10 text-warning";
  const confirmClassName = variant === "danger"
    ? "bg-danger text-white"
    : "bg-warning text-background";
  const focusClassName = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

  function closeDialog() {
    if (!controlsRef.current.pending) controlsRef.current.onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fechar confirmação"
        aria-hidden="true"
        tabIndex={-1}
        disabled={pending}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        onClick={closeDialog}
      />

      <section
        ref={dialogRef}
        className="relative z-10 my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl shadow-black/50 outline-none sm:max-h-[calc(100dvh-2rem)] sm:p-6"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-busy={pending}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description${error ? ` ${id}-error` : ""}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${iconClassName}`}>
              {icon}
            </span>

            <div className="min-w-0">
              <h2 id={`${id}-title`} className="font-display text-lg font-semibold text-foreground">
                {title}
              </h2>
              <div id={`${id}-description`} className="mt-1 space-y-3 break-words text-sm leading-6 text-muted-foreground">
                {description}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={closeDialog}
            disabled={pending}
            className={`grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusClassName}`}
            aria-label="Fechar"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <p id={`${id}-error`} className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <p className="sr-only" role="status">{pending ? pendingLabel : ""}</p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={closeDialog}
            disabled={pending}
            className={`h-10 rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusClassName}`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => { if (!controlsRef.current.pending) onConfirm(); }}
            disabled={pending}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${confirmClassName} ${focusClassName}`}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
