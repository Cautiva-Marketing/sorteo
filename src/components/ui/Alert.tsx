import type { ReactNode } from "react";

export type AlertVariant = "error" | "success" | "info";

export interface AlertProps {
  variant: AlertVariant;
  children: ReactNode;
  id?: string;
  className?: string;
}

const variantClasses: Record<AlertVariant, string> = {
  error: "border-danger-700 text-danger-700",
  success: "border-success-700 text-success-700",
  info: "border-ink-300 text-ink-900",
};

/** Mensaje destacado: los errores se anuncian de inmediato (`alert`); el resto de forma cortés. */
export function Alert({ variant, children, id, className }: AlertProps) {
  const classes = [
    "rounded-lg border bg-paper px-4 py-3 text-base",
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "error") {
    return (
      <div id={id} role="alert" className={classes}>
        {children}
      </div>
    );
  }
  return (
    <div id={id} role="status" aria-live="polite" className={classes}>
      {children}
    </div>
  );
}
